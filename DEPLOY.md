# Deploying DiaInsights

Two services: a FastAPI scoring backend and a Next.js frontend. Neither stores patient
data, so there is no database, no migration and no persistent volume to manage.

> **Decision-support only, not medical advice.**

## The files

| File | Purpose |
|---|---|
| `docker-compose.yml` | Base topology. Publishes **no** host ports on the backend or frontend. |
| `docker-compose.override.yml` | Local development. Auto-loaded by a plain `docker compose up`. Publishes `127.0.0.1:8000` and `127.0.0.1:3000`. |
| `docker-compose.prod.yml` | Production overlay. Adds Caddy, the only service publishing 80/443. |
| `Caddyfile` | Reverse proxy config, reads its domain from `{$DOMAIN}`. |

Local and production use **different** sets of files. The base file is deliberately
production-shaped and fails closed: a mistaken `docker compose up` on a server brings
the app up reachable only from that server's localhost (via
docker-compose.override.yml), never from the network, rather than exposing a
health-data service to the internet.

## Contents

- [Local development](#local-development)
- [Configuration](#configuration)
- [Production](#production)
- [Testing the production topology locally](#testing-the-production-topology-locally)
- [HTTPS notes](#https-notes)
- [Operations](#operations)
- [Alternative: two Fly.io apps](#alternative-two-flyio-apps)

---

## Local development

```powershell
Copy-Item .env.example .env
docker compose up --build
```

No `-f` flags, so Compose auto-loads `docker-compose.override.yml`.

- Frontend <http://localhost:3000>
- API <http://localhost:8000>, docs at <http://localhost:8000/docs>

Ports are bound to `127.0.0.1`, so the stack is reachable from the host but not from
the network.

Verify:

```powershell
curl.exe http://localhost:8000/health
# {"status":"ok"}

Get-Content backend\example_request.json -Raw |
  curl.exe -s -X POST http://localhost:8000/predict `
    -H "Content-Type: application/json" --data-binary "@-"
# "risk_score": 0.659, tier HIGH
```

Tear down with `docker compose down`.

### Without Docker

```powershell
cd backend; venv\Scripts\Activate.ps1; uvicorn api:app --port 8000
cd frontend; npm run dev
```

---

## Configuration

Copy `.env.example` to `.env`. Every variable is documented there. Three catch people
out:

**`NEXT_PUBLIC_API_URL` is baked in at build time.** `NEXT_PUBLIC_*` values are inlined
into the client JavaScript when Next builds. Setting it at runtime does nothing — you
must rebuild. It is also resolved by the **browser**, so it must be publicly
reachable. Use `http://localhost:8000`, never `http://backend:8000`; the service name
only resolves inside the Docker network, so using it produces an app that builds
cleanly and then fails in the browser.

**`docker-compose.prod.yml` overrides it** to `https://$DOMAIN/api`, which pairs with
the Caddyfile's `handle_path /api/*`.

**`ALLOWED_ORIGINS` must match the frontend's origin.** In production Caddy serves both
from one hostname, so it is the same origin.

---

## Production

**1. Provision a VPS** with Docker and the Compose plugin (Ubuntu 24.04 or similar).

**2. Copy the repository** to `/opt/diainsights` and create `.env`:

```bash
cd /opt/diainsights
cp .env.example .env
```

Set your domain:

```
ALLOWED_ORIGINS=https://diainsights.example.com
```

`NEXT_PUBLIC_API_URL` needs no entry — `docker-compose.prod.yml` derives it from
`DOMAIN`.

**3. Point DNS** for the domain at the VPS, then deploy:

```bash
export DOMAIN=diainsights.example.com
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

Both services plus Caddy should report healthy.

**Why the `-f` flags matter:** passing `-f` stops Compose auto-loading
`docker-compose.override.yml`, which is what keeps the dev port mappings out of
production. CI asserts this.

### How the routing works

```
browser  ──https://diainsights.example.com/api/predict──▶  Caddy
                                                            │ handle_path strips /api
                                                            ▼
                                                        backend:8000/predict
```

`handle_path` removes the matched prefix before proxying. The backend serves `/predict`,
`/predict/whatif` and `/health`, and the frontend calls `<API_BASE_URL>/predict`. If
`handle_path` were `handle`, the `/api` prefix would survive and every call would 404.

Because both the frontend and the API are served from one hostname, **CORS is not used
in production**. Everything is same-origin.

### The proxy rate limiter

Caddy sets `TRUST_PROXY_HEADERS=1` and `FORWARDED_TRUSTED_HOPS=1`. Behind a proxy every
client otherwise shares the proxy's address, so the limiter would treat all visitors as
one person and cap the entire site at `RATE_LIMIT_PER_MINUTE`.

This is safe because Caddy **rewrites** `X-Forwarded-For` rather than appending to a
client-supplied one, and the API counts the header **from the right**. Anything left of
our own proxy's entry is client-supplied and cannot be used to mint extra buckets. Do
not disable this, and do not point `NEXT_PUBLIC_API_URL` straight at the API from a
browser that can reach anything else.

---

## Testing the production topology locally

Rehearse the real thing, including Caddy and HTTPS:

```powershell
$env:DOMAIN = "localhost"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

- <https://localhost> — the whole app, same origin
- Caddy issues its own internal certificate for `localhost`, so the browser warns once.
  That is expected locally; with a real domain it uses a Let's Encrypt certificate.

Tear down and return to plain development with `docker compose down` followed by
`docker compose up`.

---

## HTTPS notes

- Always serve over HTTPS. The app handles real health information; plain HTTP would put
  it on the wire in the clear. Caddy and Fly both handle this for you.
- Certificates live in the named `caddy_data` volume. **Do not delete it casually** —
  losing it forces Caddy to re-request certificates, and Let's Encrypt rate-limits
  repeat requests.
- The frontend sends `Strict-Transport-Security`, so browsers refuse plaintext HTTP to
  the domain for a year after a first HTTPS visit.
- `X-Forwarded-Proto` is unused by this app, so nothing special is needed behind a
  TLS-terminating proxy.

---

## Operations

**Logs contain no patient data.** The backend runs uvicorn with `--no-access-log`, so
nothing about any request reaches stdout. Request bodies are never logged. Caddy's log
format is set to `console` explicitly so headers and bodies cannot be added later. The
rate limiter stores only an IP and timestamps, in memory, discarded after a minute.

**One worker, on purpose.** The rate limiter is an in-memory dict. N workers would mean
N independent limiters and N× the effective limit. Move the limiter to Redis *before*
raising `--workers`.

**Scaling.** The backend is CPU-bound and serialises scoring behind a lock, because
matplotlib is not thread-safe. One instance suits a small site; beyond that you need a
shared rate limiter first.

**Upgrading the CSP.** The policy allows `'unsafe-inline'` for scripts and styles
because the App Router inlines its hydration payload and Tailwind injects a style
element. A stricter policy needs a per-request nonce via `src/middleware.ts`; test it
carefully or the app will fail to hydrate.

---

## Alternative: two Fly.io apps

Fly.io does **not** support a two-service compose file where both services build their
own image: deploying one fails with
`only one service can specify build, found 2 services with build`. Fly's own docs list
no `compose` key under `[build]`, and their team confirms the single-build limitation.
So on Fly you deploy two separate apps, one per Dockerfile, and Caddy is not available.

```powershell
cd backend
fly launch --no-deploy
fly deploy

cd ..\frontend
fly launch --no-deploy
fly deploy --build-arg NEXT_PUBLIC_API_URL=https://<api-app>.fly.dev
```

Then set `ALLOWED_ORIGINS=https://<frontend-app>.fly.dev` on the backend app and
redeploy it.

The differences from the Caddy route: the API gets its own public hostname, so
`NEXT_PUBLIC_API_URL` points at `https://<api-app>.fly.dev` rather than a same-origin
`/api` path, and CORS is back in play. You also have two deploys and two sets of logs.