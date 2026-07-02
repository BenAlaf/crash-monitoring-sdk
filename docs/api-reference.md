# API reference

Base URL: `https://crash-monitoring-sdk.vercel.app` · interactive Swagger UI: [`/apidocs`](https://crash-monitoring-sdk.vercel.app/apidocs/) · Postman collection: [`api/postman/`](https://github.com/BenAlaf/crash-monitoring-sdk/tree/main/api/postman)

## Authentication — two roles

| Header | Role | Can |
|---|---|---|
| `X-API-Key: <app api_key>` | **SDK** (per app) | ingest crashes & sessions for **its own app only** |
| `X-Admin-Key: <admin key>` | **Admin** (portal) | everything: apps CRUD, issues, stats |

Errors are always `{"error": "message"}` with a proper status code (400/401/404/409/500).

## Public

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check — service + database status |
| GET | `/apidocs` | Swagger UI |
| GET | `/portal/` | Admin portal (single-page app) |

## SDK endpoints (X-API-Key)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/crashes` | Ingest crash/error report(s) — one object **or** an array (≤ 20). Grouped into issues by server-side fingerprint. Returns `201` with `[{event_id, issue_id, fingerprint}]`. |
| POST | `/api/v1/sessions` | Launch ping `{install_id, app{…}, device{…}}` — insert-only; powers crash-free users. |

Example — ingest one crash:

```bash
curl -X POST https://crash-monitoring-sdk.vercel.app/api/v1/crashes \
  -H "X-API-Key: YOUR_APP_KEY" -H "Content-Type: application/json" \
  -d '{
    "install_id": "3f2b6c1e-…",
    "timestamp": "2026-07-02T14:03:22.123Z",
    "is_fatal": true,
    "app": {"package_name": "com.example.foo", "version_name": "1.2.0", "version_code": 12},
    "device": {"manufacturer": "Samsung", "model": "SM-G991B", "os_version": "14", "sdk_int": 34},
    "thread": "main",
    "exception": {
      "type": "java.lang.IllegalStateException",
      "message": "fragment not attached",
      "frames": [{"cls": "com.example.foo.MainActivity", "method": "onClick", "file": "MainActivity.kt", "line": 42}],
      "cause": null
    },
    "raw_stack_trace": "java.lang.IllegalStateException: …",
    "breadcrumbs": [{"ts": "2026-07-02T14:03:20Z", "message": "clicked checkout"}],
    "custom": {"cart_size": "3"}
  }'
```

Validation: `install_id`, `timestamp` (ISO-8601), `app.package_name`, `app.version_name`, `exception.type` and `exception.frames` are required; the package name must match the app the API key belongs to. Payload caps: 16 KB raw trace, 30 breadcrumbs, 20 custom keys. Batches are all-or-nothing validated.

## Admin — apps CRUD (X-Admin-Key)

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/apps` | Register `{name, package_name}` → returns the generated `api_key`. `409` on duplicate package. |
| GET | `/api/v1/apps` | List apps with issue/event counts. |
| GET | `/api/v1/apps/{app_id}` | One app. |
| PUT | `/api/v1/apps/{app_id}` | Rename and/or `{"regenerate_api_key": true}`. |
| DELETE | `/api/v1/apps/{app_id}` | Delete the app **and cascade** all its issues, events, users and sessions. |

## Admin — issues (X-Admin-Key)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/apps/{app_id}/issues` | Grouped issues. Query: `status` (open/resolved/ignored), `is_fatal`, `app_version`, `sort` (last_seen · event_count · user_count · first_seen), `page`, `limit` (≤ 100). |
| GET | `/api/v1/issues/{issue_id}` | Issue detail incl. the latest stack trace. |
| GET | `/api/v1/issues/{issue_id}/events` | Paged individual occurrences, newest first. |
| PATCH | `/api/v1/issues/{issue_id}` | `{"status": "open" \| "resolved" \| "ignored"}`. |
| DELETE | `/api/v1/issues/{issue_id}` | Delete the issue and its events. |

## Admin — stats (X-Admin-Key)

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/apps/{app_id}/stats/overview` | Counters: totals, open issues, affected users, 24 h/7 d activity, `session_users_30d`, `crash_free_users_30d` (0..1 or null with no sessions). |
| GET | `/api/v1/apps/{app_id}/stats/timeseries?days=30[&issue_id=…]` | Zero-filled events-per-day `[{date, count, fatal}]` (≤ 90 days), by crash time. |
| GET | `/api/v1/apps/{app_id}/stats/breakdown?by=app_version[&days=…][&issue_id=…]` | Buckets `[{key, count, users}]` by `app_version` / `os_version` / `device_model`, top 12 by count. |

All stats are MongoDB aggregation pipelines over the raw events — nothing is precomputed except the issue counters.

## Running the API locally

```bash
cd api
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
cp .env.example .env       # fill in Atlas credentials + ADMIN_KEY
./.venv/bin/python app.py  # serves on :8082 with live Swagger at /apidocs
./.venv/bin/python -m pytest tests/   # fingerprint unit tests
./.venv/bin/python seed.py            # realistic demo data
```
