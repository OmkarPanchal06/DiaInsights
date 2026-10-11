"""Rate-limit key resolution.

The property that matters: a caller must never be able to change their rate-limit
bucket by setting a header. X-Forwarded-For is client-supplied, so it is only read
when explicitly trusted, and even then only from the right-hand side.
"""
import pytest


class FakeRequest:
    """Minimal stand-in for a starlette Request."""

    def __init__(self, headers=None, peer="10.0.0.9"):
        self.headers = headers or {}
        self.client = type("C", (), {"host": peer})()


@pytest.fixture
def api_module():
    import api

    return api


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    """Module-level config is read at import time, so pin it explicitly per test."""
    for key in ("TRUST_PROXY_HEADERS", "FORWARDED_TRUSTED_HOPS", "RATE_LIMIT_PER_MINUTE"):
        monkeypatch.delenv(key, raising=False)
    yield


# ---------------------------------------------------------------- untrusted

def test_untrusted_ignores_forwarded_header(monkeypatch, api_module):
    """Default posture: a spoofed header has no effect at all."""
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", False)
    req = FakeRequest(headers={"x-forwarded-for": "1.2.3.4"}, peer="10.0.0.9")
    assert api_module.client_ip(req) == "10.0.0.9"


def test_untrusted_forged_header_cannot_change_key(monkeypatch, api_module):
    """Two peers sending the same forged header must stay in separate buckets."""
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", False)
    a = FakeRequest(headers={"x-forwarded-for": "9.9.9.9"}, peer="10.0.0.1")
    b = FakeRequest(headers={"x-forwarded-for": "9.9.9.9"}, peer="10.0.0.2")
    assert api_module.client_ip(a) != api_module.client_ip(b)
    assert api_module.client_ip(a) == "10.0.0.1"


# ------------------------------------------------------------------- trusted

def test_trusted_single_proxy_uses_rightmost(monkeypatch, api_module):
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(api_module, "FORWARDED_TRUSTED_HOPS", 1)
    req = FakeRequest(headers={"x-forwarded-for": "203.0.113.5"})
    assert api_module.client_ip(req) == "203.0.113.5"


def test_trusted_ignores_forged_leftmost_entry(monkeypatch, api_module):
    """The core security property.

    A client forging entries to the LEFT of our own proxy's entry must still be keyed
    on the address the proxy actually recorded.
    """
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(api_module, "FORWARDED_TRUSTED_HOPS", 1)

    # Attacker sends "XFF: 9.9.9.9"; the proxy appends the real peer -> two entries.
    req = FakeRequest(headers={"x-forwarded-for": "9.9.9.9, 203.0.113.5"})
    assert api_module.client_ip(req) == "203.0.113.5"
    assert api_module.client_ip(req) != "9.9.9.9"


def test_trusted_forged_header_does_not_split_buckets(monkeypatch, api_module):
    """Two callers behind one proxy, both forging different prefixes, share a bucket."""
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(api_module, "FORWARDED_TRUSTED_HOPS", 1)

    a = FakeRequest(headers={"x-forwarded-for": "9.9.9.9, 203.0.113.5"})
    b = FakeRequest(headers={"x-forwarded-for": "8.8.8.8, 203.0.113.5"})
    assert api_module.client_ip(a) == api_module.client_ip(b) == "203.0.113.5"


def test_trusted_two_hops(monkeypatch, api_module):
    """With two proxies the client is the 2nd entry from the right."""
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(api_module, "FORWARDED_TRUSTED_HOPS", 2)
    # forged, real-client, proxyB
    req = FakeRequest(headers={"x-forwarded-for": "9.9.9.9, 203.0.113.5, 198.51.100.7"})
    assert api_module.client_ip(req) == "203.0.113.5"


def test_trusted_falls_back_when_header_too_short(monkeypatch, api_module):
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(api_module, "FORWARDED_TRUSTED_HOPS", 2)
    req = FakeRequest(headers={"x-forwarded-for": "203.0.113.5"}, peer="10.0.0.9")
    assert api_module.client_ip(req) == "10.0.0.9"


def test_trusted_handles_missing_and_malformed_headers(monkeypatch, api_module):
    monkeypatch.setattr(api_module, "TRUST_PROXY_HEADERS", True)
    monkeypatch.setattr(api_module, "FORWARDED_TRUSTED_HOPS", 1)

    assert api_module.client_ip(FakeRequest(headers={}, peer="10.0.0.9")) == "10.0.0.9"
    assert (
        api_module.client_ip(FakeRequest(headers={"x-forwarded-for": ""}, peer="10.0.0.9"))
        == "10.0.0.9"
    )
    assert (
        api_module.client_ip(FakeRequest(headers={"x-forwarded-for": " , , "}, peer="10.0.0.9"))
        == "10.0.0.9"
    )


# ------------------------------------------------------------ env robustness

def test_bad_env_values_fall_back_to_defaults(monkeypatch, api_module):
    monkeypatch.setenv("FORWARDED_TRUSTED_HOPS", "not-a-number")
    monkeypatch.setenv("RATE_LIMIT_PER_MINUTE", "not-a-number")
    assert api_module._env_int("FORWARDED_TRUSTED_HOPS", 1) == 1
    assert api_module._env_int("RATE_LIMIT_PER_MINUTE", 60) == 60


@pytest.mark.parametrize("raw,expected", [
    ("1", True), ("true", True), ("YES", True), ("on", True),
    ("0", False), ("false", False), ("", False), ("maybe", False),
])
def test_env_flag_parsing(monkeypatch, api_module, raw, expected):
    monkeypatch.setenv("TRUST_PROXY_HEADERS", raw)
    assert api_module._env_flag("TRUST_PROXY_HEADERS") is expected


def test_hops_are_clamped_to_at_least_one(monkeypatch, api_module):
    """FORWARDED_TRUSTED_HOPS=0 must not index from position 0 (the forged edge)."""
    monkeypatch.setenv("FORWARDED_TRUSTED_HOPS", "0")
    assert max(1, api_module._env_int("FORWARDED_TRUSTED_HOPS", 1)) == 1