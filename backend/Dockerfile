# syntax=docker/dockerfile:1
#
# DiaInsights backend.
#
# Python 3.13 matches backend/venv (3.13.2), which is the version the wheels in
# requirements.txt were verified against.
#
# ONE worker, deliberately. The rate limiter is an in-memory dict, so N workers would
# mean N independent limiters and N x RATE_LIMIT_PER_MINUTE in practice. Move the
# limiter to Redis before ever raising this.

# ---------------------------------------------------------------- builder
FROM python:3.13-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /build

# libgomp1 is required by xgboost at import time.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --upgrade pip \
    && /opt/venv/bin/pip install -r requirements.txt

# ---------------------------------------------------------------- runtime
FROM python:3.13-slim AS runtime

# libgomp1 again: it is needed to *run* xgboost, not just to install it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin app

COPY --from=builder /opt/venv /opt/venv

WORKDIR /app
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MPLBACKEND=Agg \
    MPLCONFIGDIR=/tmp/matplotlib

# Model artefacts are committed source-of-truth inputs. Only these files ship: no
# venv, no tests, no __pycache__.
COPY --chown=app:app model/ ./model/
COPY --chown=app:app api.py diabetes_pipeline.py ./

USER app

EXPOSE 8000

# No curl in the slim image; use the interpreter we already ship.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"]

# --no-access-log: nothing about a request is written to stdout at all. AGENTS.md
# forbids logging patient health data, and the access log is the easiest place for it
# to creep back in.
#
# --no-proxy-headers is REQUIRED, not cosmetic. Uvicorn enables proxy-header handling
# by default and rewrites request.client.host from the LEFTMOST X-Forwarded-For entry.
# That would bypass api.client_ip() entirely and let a caller forge their rate-limit
# bucket -- the exact hole the custom resolver closes. The resolver reads from the
# right-hand side instead, and TRUST_PROXY_HEADERS keeps it off unless asked.
#
# Single worker because the rate limiter is a per-process in-memory dict.
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", "--no-access-log", "--no-proxy-headers"]