# Implementation Plan — Crash & Error Monitoring SDK ("CrashMonitor")

A mini-Sentry for Android, built as the final project for 26A-10221 Advanced Seminar in Mobile Development (Idea #9 — Crash Reports SDK).

**Fixed stack:** Flask + MongoDB Atlas + Vercel (API) · Kotlin Android library → JitPack · MIT license · single mono-repo.

**Conventions mirrored from the course examples:**
- API structure mirrors [`TomCo2210/26A-10221-API-Flask-FeatureToggle`](https://github.com/TomCo2210/26A-10221-API-Flask-FeatureToggle): `app.py` + `routes.py` + `controllers/` blueprints, `MongoConnectionHolder` singleton, Flasgger (Swagger) docstrings on every route, `requirements.txt` + `runtime.txt`, config via `python-dotenv`.
- Android structure mirrors [`TomCo2210/25A-10221-FeatureToggleDemoApp`](https://github.com/TomCo2210/25A-10221-FeatureToggleDemoApp): one Gradle project at repo root containing the **library module** and the **demo app module**, `jitpack.yml` (openjdk17) at root, version catalog in `gradle/libs.versions.toml`, `maven-publish` applied **only** to the library module so the JitPack coordinate is `com.github.BenAlaf:<repo>:<tag>`, Retrofit + Gson declared with `api` scope and propagated into the POM.
- (Note: the course README links the older `26A-10221-FeatureToggle_Flask_API` URL, which 404s — the live repo is `26A-10221-API-Flask-FeatureToggle`.)

---

## 1. Architecture

```
┌─────────────────────────────┐
│ Android device              │
│ ┌─────────────────────────┐ │
│ │ Host app (demo: app/)   │ │
│ │  └─ CrashMonitor SDK    │ │        HTTPS (Retrofit, X-API-Key)
│ │     ├─ CrashHandler ────┼─┼──┐  1. crash → write JSON to disk (sync)
│ │     ├─ Disk queue       │ │  │  2. next launch → upload queue
│ │     │  (filesDir/…)     │ │  │
│ │     └─ Uploader ────────┼─┼──┼────────────┐
│ └─────────────────────────┘ │  │            ▼
└─────────────────────────────┘  │   ┌──────────────────────────────┐
                                 │   │ Flask API (Vercel, api/)     │
┌─────────────────────────────┐  │   │  ├─ /api/v1/crashes  ingest  │
│ Developer's browser         │  │   │  │   └─ fingerprint → upsert │
│  Portal (HTML+JS+Chart.js,  │──┼──▶│  ├─ /api/v1/sessions ingest  │
│  served by Flask /portal,   │      │  ├─ /api/v1/apps     CRUD    │
│  X-Admin-Key)               │      │  ├─ /api/v1/…/issues CRUD    │
└─────────────────────────────┘      │  ├─ /api/v1/…/stats  charts  │
                                     │  └─ /apidocs (Swagger)       │
                                     └──────────────┬───────────────┘
                                                    ▼
                                     ┌──────────────────────────────┐
                                     │ MongoDB Atlas                │
                                     │  apps · issues · events ·    │
                                     │  issue_users · sessions      │
                                     └──────────────────────────────┘
```

### The two core mechanisms

**1. Capture-before-death (disk-first, upload-later).**
A crashing process cannot be trusted to complete a network call. The SDK therefore never uploads from the crash handler. `Thread.UncaughtExceptionHandler` builds the report and **synchronously** writes one JSON file to a private queue directory, then delegates to the previously-installed handler so the OS crash flow is preserved. On the **next** `CrashMonitor.init()` (next app launch) a background uploader drains the queue: POST each file, delete on 2xx, keep for retry on failure. This one durable queue also serves non-fatal errors (`logException`) and satisfies the assignment's offline requirement for free — no network means files simply accumulate and are sent on a later launch.

**2. Fingerprint-based grouping (one bug = one Issue).**
Every report is reduced to a deterministic fingerprint; all occurrences with the same fingerprint upsert into a single `issues` document with atomic counters (`$inc`, `$min`/`$max`). The portal reads the small `issues` collection, never scans raw events. The fingerprint is computed **server-side** from the structured report (single source of truth — grouping can be improved without shipping a new SDK version; SDK stays dumb).

Fingerprint recipe (unit-tested, documented in `docs/`):
```
root = deepest exception in the cause chain
frames = first 5 stack frames whose class starts with the app's package
         (fallback: first 3 frames overall, if no in-app frames)
fingerprint = SHA-256( package_name + "|" + root.type + "|" +
                       join(frames as "class#method") )
```
Deliberately excluded: exception *message* (varies per occurrence: "index 5" vs "index 7"), *line numbers* (survive cosmetic edits), *app version* (same bug across versions = same issue, with a per-version breakdown instead).

### Components

| Component | Deliverable | Tech | Deploy target |
|---|---|---|---|
| Backend API | #1 | Flask + PyMongo + Flasgger | Vercel (root dir `api/`) + MongoDB Atlas M0 |
| Android library `crashmonitor` | #2 | Kotlin, Retrofit2 + Gson | JitPack (git tag) |
| Demo app `app` | #3 | Kotlin | APK / Android Studio run |
| Documentation | #4 | Markdown in `docs/` | GitHub Pages (main branch, `/docs`) |
| README | #5 | Markdown | repo root |
| LICENSE | #6 | MIT (already committed) | repo root |
| Admin portal | #7 | Static HTML/JS + Chart.js (CDN), served by Flask | same Vercel deployment |

---

## 2. Repo structure (mono-repo)

The Android Gradle project **must own the repo root** — JitPack builds whatever Gradle project sits at the root (this is exactly how the FeatureToggleDemoApp repo is laid out). The other components live in subdirectories that Gradle ignores:

```
crash-monitoring-sdk/
├── README.md                        # Deliverable 5
├── LICENSE                          # Deliverable 6 (MIT — done)
├── IMPLEMENTATION_PLAN.md           # this file
├── .gitignore                       # Android + Python + .env + .idea
├── jitpack.yml                      # jdk: openjdk17
├── settings.gradle.kts              # include(":crashmonitor", ":app")
├── build.gradle.kts / gradle.properties / gradlew* / gradle/
│   └── libs.versions.toml           # AGP, Kotlin, Retrofit, versions
│
├── crashmonitor/                    # Deliverable 2 — the SDK (Android library, Kotlin)
│   ├── build.gradle.kts             # android.library + maven-publish (only module that publishes)
│   ├── consumer-rules.pro           # keep Gson model classes
│   └── src/main/java/com/benalaf/crashmonitor/
│       ├── CrashMonitor.kt          # public facade (init, logException, breadcrumbs, flush)
│       ├── CrashMonitorConfig.kt    # apiKey, baseUrl, caps, flags
│       ├── internal/CrashHandler.kt # UncaughtExceptionHandler
│       ├── internal/ReportFactory.kt# Throwable+device+app → CrashReport
│       ├── internal/ReportStore.kt  # disk queue (one JSON file per report)
│       ├── internal/Uploader.kt     # drains queue via Retrofit
│       ├── internal/CrashApi.kt     # Retrofit interface
│       └── model/…                  # CrashReport, ExceptionInfo, Frame, DeviceInfo…
│
├── app/                             # Deliverable 3 — demo app (Kotlin)
│   └── src/main/…                   # crash buttons, non-fatal button, flush, status view
│
├── api/                             # Deliverable 1 — Flask service (Vercel Root Directory = api/)
│   ├── app.py                       # Flask + Swagger + Mongo init + routes (mirrors example)
│   ├── routes.py                    # init_routes(app) registering blueprints
│   ├── controllers/
│   │   ├── apps.py                  # apps CRUD (admin)
│   │   ├── crashes.py               # ingest endpoint (SDK)
│   │   ├── sessions.py              # session ping endpoint (SDK)
│   │   ├── issues.py                # issue list/detail/update/delete
│   │   ├── stats.py                 # aggregation endpoints for charts
│   │   └── portal.py                # serves portal static files at /portal
│   ├── services/
│   │   ├── fingerprint.py           # grouping algorithm (pure function)
│   │   └── auth.py                  # X-API-Key / X-Admin-Key decorators
│   ├── mongodb_connection_holder.py # singleton, same shape as course example
│   ├── portal/                      # Deliverable 7 — index.html, app.js, style.css (Chart.js via CDN)
│   ├── tests/test_fingerprint.py    # pytest for the grouping function
│   ├── postman/crashmonitor.postman_collection.json
│   ├── seed.py                      # generates fake apps/crashes/sessions for demo & portal dev
│   ├── requirements.txt             # flask, flasgger, python-dotenv, pymongo
│   ├── runtime.txt                  # python-3.12
│   └── .env.example                 # DB_CONNECTION_STRING, DB_NAME, DB_USERNAME, DB_PASSWORD, ADMIN_KEY
│
└── docs/                            # Deliverable 4 — GitHub Pages (Settings → Pages → main /docs)
    ├── _config.yml                  # Jekyll theme (no build step)
    ├── index.md                     # overview + architecture diagram (PNG + mermaid source)
    ├── getting-started.md           # SDK integration in 5 minutes
    ├── library-reference.md         # public Kotlin API
    ├── api-reference.md             # endpoint tables + curl examples + link to live /apidocs
    ├── data-model.md                # collections, fingerprinting explained
    ├── portal-guide.md              # screenshots, workflows
    └── assets/                      # diagrams, screenshots
```

Deployment wiring from one repo: **JitPack** builds the root Gradle project on git tags · **Vercel** project with Root Directory `api/` auto-deploys on push (Flask preset; env vars set in dashboard; Atlas network access `0.0.0.0/0` because Vercel IPs are dynamic) · **GitHub Pages** serves `/docs` from `main`.

---

## 3. MongoDB data model

One database (e.g. `crash_monitor`), five fixed collections. Unlike the FeatureToggle example (collection per package name), crash data needs cross-collection aggregation and indexes, so collections are fixed and app-scoped by field.

### `apps` — registered applications
```js
{
  _id: "uuid",                      // string uuid4, mirrors course convention
  package_name: "com.example.foo",  // unique
  name: "Foo App",
  api_key: "uuid",                  // unique; shown once at creation; SDK auth
  created_at: ISODate, updated_at: ISODate
}
```
Indexes: `{package_name: 1}` unique · `{api_key: 1}` unique.

### `issues` — one document per distinct bug (the grouping target)
```js
{
  _id: "uuid",
  app_id: "uuid",
  fingerprint: "sha256-hex",
  exception_type: "java.lang.NullPointerException",   // from root cause
  sample_message: "Attempt to invoke virtual method…", // first seen, for display
  location: "MainActivity#onClick",                    // top in-app frame, the issue "title"
  is_fatal: true,                                      // crash vs handled error
  status: "open" | "resolved" | "ignored",
  event_count: 421,                 // $inc on every ingest
  user_count: 37,                   // $inc only when issue_users upsert inserts
  first_seen: ISODate,              // $min
  last_seen: ISODate,               // $max
  last_event: { app_version, os_version, device_model, raw_stack_trace (capped) },
  created_at: ISODate, updated_at: ISODate
}
```
Indexes: `{app_id: 1, fingerprint: 1}` unique (the upsert key) · `{app_id: 1, last_seen: -1}` · `{app_id: 1, status: 1, event_count: -1}`.

### `events` — individual occurrences (source of truth for breakdowns)
```js
{
  _id: "uuid",
  app_id: "uuid", issue_id: "uuid", fingerprint: "…",
  install_id: "uuid",               // anonymous per-install id → "users"
  timestamp: ISODate,               // client crash time (clamped to received_at if in future)
  received_at: ISODate,             // server time
  is_fatal: true,
  app_version: "1.2.0", version_code: 12,
  os_version: "14", sdk_int: 34,
  device_manufacturer: "Samsung", device_model: "SM-G991B",
  thread: "main",
  exception: { type, message, frames: [{cls, method, file, line}], cause: {…} },
  raw_stack_trace: "…",             // capped at 16 KB
  breadcrumbs: [{ts, message}],     // capped at 30
  custom: { k: v }                  // capped at 20 keys
}
```
Indexes: `{issue_id: 1, timestamp: -1}` · `{app_id: 1, received_at: -1}` (chart range scans) · `{app_id: 1, app_version: 1}`.

### `issue_users` — dedup set for distinct-user counting
```js
{ issue_id: "uuid", install_id: "uuid", first_seen: ISODate }
```
Index: `{issue_id: 1, install_id: 1}` unique. On ingest, upsert here; if it inserted a new doc, `$inc issues.user_count`. O(1) per event, no unbounded arrays on the issue doc.

### `sessions` — lightweight launch pings (the crash-free denominator)
```js
{
  _id: "uuid",
  app_id: "uuid", install_id: "uuid",
  received_at: ISODate,
  app_version: "1.2.0", version_code: 12,
  os_version: "14", sdk_int: 34,
  device_manufacturer: "Samsung", device_model: "SM-G991B"
}
```
Index: `{app_id: 1, received_at: -1}`. Insert-only, one doc per app launch, no ingest-time bookkeeping. Powers the headline metric, computed by aggregation:
`crash-free users (period) = 1 − distinct(install_id in fatal events) / distinct(install_id in sessions)`.

### Ingest write path (atomic, per report)
1. Resolve app by `X-API-Key` → 401 if unknown.
2. Validate + cap payload sizes; compute `fingerprint` (`services/fingerprint.py`).
3. `issues.find_one_and_update({app_id, fingerprint}, {$setOnInsert: identity fields, $inc: {event_count: 1}, $min: {first_seen}, $max: {last_seen}, $set: {last_event}}, upsert=True)`.
4. `events.insert_one(...)`.
5. `issue_users.update_one(..., upsert=True)` → if upserted, `$inc user_count`.

### Efficiency story (explicit assignment goal)
- Reads are served by `issues` (hundreds of docs), never by scanning `events` (potentially millions).
- Counters are denormalized onto `issues` with atomic single-doc updates — the portal's issue table costs one indexed query.
- Version/device/OS breakdowns are **not** cached on the issue (MongoDB keys can't safely contain dots like `"1.2.0"`); they are computed by aggregation pipelines on `events` using the indexes above — cheap because portal reads are rare and ingest stays a fixed 3 writes.
- Payload caps at ingest (stack 16 KB, 30 breadcrumbs, 20 custom keys); pending-queue cap in the SDK (50 files, drop oldest).
- Stretch: TTL indexes on `events.received_at` / `sessions.received_at` (e.g. 90 days) — issues and their counters survive raw-event expiry.

---

## 4. API endpoints

Conventions (all mirroring the course example): JSON bodies, `jsonify` responses, proper status codes (201/400/401/404/500), Flasgger YAML docstring on every route → live Swagger UI at `/apidocs`, string uuid4 `_id`s, env config via dotenv. All endpoints under `/api/v1`. Errors: `{"error": "message"}`.

**Auth model** (deliverable 7 requires authentication + authorization):
- `X-API-Key: <app api_key>` — SDK role; may only ingest for its own app.
- `X-Admin-Key: <ADMIN_KEY env>` — admin role; portal & CRUD endpoints.
- Implemented as two small decorators in `services/auth.py`.

### Public
| Method | Path | Purpose |
|---|---|---|
| GET | `/` | health check ("CrashMonitor API is running") |
| GET | `/apidocs` | Swagger UI (Flasgger) |

### SDK-facing (X-API-Key)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/crashes` | Ingest crash/error report(s). Accepts a single report object **or** an array (≤ 20) — the uploader drains its whole queue in one call. Returns 201 with `[{event_id, issue_id, fingerprint}]`. |
| POST | `/api/v1/sessions` | Session ping, sent fire-and-forget on every `init()`. Body: `{install_id, timestamp, app{…}, device{…}}` (a subset of the crash payload). Insert-only; supplies the crash-free-users denominator. |

Sample request body (defines the SDK ↔ API contract):
```json
{
  "install_id": "3f2b…", "timestamp": "2026-07-02T14:03:22.123Z", "is_fatal": true,
  "app": {"package_name": "com.example.foo", "version_name": "1.2.0", "version_code": 12},
  "device": {"manufacturer": "Samsung", "model": "SM-G991B", "os_version": "14", "sdk_int": 34},
  "thread": "main",
  "exception": {
    "type": "java.lang.IllegalStateException", "message": "fragment not attached",
    "frames": [{"cls": "com.example.foo.MainActivity", "method": "onClick", "file": "MainActivity.kt", "line": 42}],
    "cause": null
  },
  "raw_stack_trace": "java.lang.IllegalStateException: …\n\tat com.example…",
  "breadcrumbs": [{"ts": "2026-07-02T14:03:20.000Z", "message": "clicked checkout"}],
  "custom": {"cart_size": "3"}
}
```

### Admin — apps CRUD (X-Admin-Key) — full CRUD per deliverable 7
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/v1/apps` | Register app `{name, package_name}` → returns generated `api_key` (Create) |
| GET | `/api/v1/apps` | List apps with issue/event counts (Read) |
| GET | `/api/v1/apps/{app_id}` | App detail (Read) |
| PUT | `/api/v1/apps/{app_id}` | Rename / regenerate api_key (Update) |
| DELETE | `/api/v1/apps/{app_id}` | Delete app + cascade issues/events/issue_users (Delete) |

### Admin — issues (X-Admin-Key)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/apps/{app_id}/issues` | Grouped issue list; query: `status`, `app_version`, `is_fatal`, `sort` (last_seen\|event_count\|user_count), `page`/`limit` |
| GET | `/api/v1/issues/{issue_id}` | Issue detail incl. representative stack trace |
| GET | `/api/v1/issues/{issue_id}/events` | Paged occurrences |
| PATCH | `/api/v1/issues/{issue_id}` | Update `status` (open/resolved/ignored) |
| DELETE | `/api/v1/issues/{issue_id}` | Delete issue + its events |

### Admin — analytics (X-Admin-Key) — the slide's "analysis and trends" requirement
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/apps/{app_id}/stats/overview` | Cards: total events, open issues, affected users, crash-free users % (last 30 d, from `sessions`), events last 24 h / 7 d |
| GET | `/api/v1/apps/{app_id}/stats/timeseries?days=30` | Crashes per day (line chart); optional `issue_id` filter |
| GET | `/api/v1/apps/{app_id}/stats/breakdown?by=app_version\|os_version\|device_model` | Grouped counts (bar/pie); optional `issue_id` filter |

All stats are MongoDB aggregation pipelines on `events` (`$match` → `$group` → `$sort`), showcasing the DB-side analysis capability.

---

## 5. Android library (`crashmonitor`, Kotlin)

### Public API (the whole surface — small on purpose, like the FeatureToggle facade)
```kotlin
object CrashMonitor {
    fun init(context: Context, config: CrashMonitorConfig)   // Application.onCreate
    fun logException(t: Throwable, custom: Map<String, String> = emptyMap()) // non-fatal
    fun addBreadcrumb(message: String)                        // ring buffer, 30 max
    fun setCustomKey(key: String, value: String)
    fun flush()                                               // force upload attempt now (demo/testing)
    fun pendingReportCount(): Int                             // for the demo app UI
}

class CrashMonitorConfig private constructor(…) {             // Builder pattern
    // apiKey (required), baseUrl (defaults to deployed Vercel URL),
    // enabled(true), maxPendingReports(50)
}
```

### Crash-capture mechanism (mechanism #1, step by step)

**At `init()`** — (1) create `filesDir/crashmonitor/queue/` and load/create the `install_id` UUID in SharedPreferences; (2) snapshot static context (package name, versionName/versionCode via PackageManager, Build.MANUFACTURER/MODEL/VERSION); (3) save `Thread.getDefaultUncaughtExceptionHandler()` and install `CrashHandler` wrapping it (idempotent — second `init` is a no-op); (4) kick the **Uploader** on a single-thread executor to drain any queue left by a previous run; (5) send a fire-and-forget session ping (`POST /api/v1/sessions`) on that same executor — sessions are statistics, not evidence, so a failed ping is dropped rather than queued.

**At crash time (`CrashHandler.uncaughtException(thread, throwable)`)** — everything wrapped in try/catch/finally; the SDK must never mask or replace the crash:
1. Build the report **in memory**: walk the `Throwable` cause chain into structured frames + `stackTraceToString()` (capped 16 KB), attach thread name, timestamp, breadcrumb ring buffer, custom keys, device/app snapshot, `install_id`, `is_fatal = true`.
2. Write **synchronously** on the crashing thread: serialize to `queue/<uuid>.json.tmp`, then rename to `.json` (rename is atomic — the uploader can never read a half-written file). No network, no new threads, no locks shared with the uploader. Target < 50 ms.
3. `finally`: delegate to the previously-installed default handler → OS shows the crash dialog and kills the process normally.

**At next launch (Uploader)** — list `queue/*.json` (oldest first), POST as one batch to `/api/v1/crashes` via Retrofit2 + Gson (`api` scope, propagated to the POM exactly like the course example), delete files on 2xx, keep on any failure (retry on the launch after that). Also triggered by `logException` (which just persists a report with `is_fatal=false` and pokes the uploader — one code path for everything) and by `flush()`.

**Edge cases handled:** exception inside the handler (swallow, still delegate); disk full (swallow); queue over `maxPendingReports` (drop oldest); duplicate `init`; upload racing a new crash (file-per-report + atomic rename makes this safe); huge traces (cap); client clock skew (server clamps); no PII collected — `install_id` is a random UUID.

**Dependencies:** Retrofit 2.x + converter-gson only (matches course Retrofit example). minSdk 26, JDK 17, AGP per course catalog. Unit tests: report building from a synthetic Throwable, queue write/drain/cap logic (Robolectric or plain JUnit with temp dirs).

**Publishing:** `maven-publish` on this module only, `afterEvaluate` publication with POM dependency propagation (copied from the course guide), root `jitpack.yml`. Versioning per the semantic-versioning guide: start `0.1.0`, breaking changes free before `1.0.0`, tag `1.0.0` for submission. Consumers add JitPack repo + `implementation("com.github.BenAlaf:crash-monitoring-sdk:1.0.0")`.

---

## 6. Demo app (`app/`, Kotlin)

Purpose: prove every library feature live in the class demo, in under two minutes.

- Integrates the SDK **via the JitPack coordinate** in the final build (deliverable requires proving the published artifact works; during development a project dependency is used, switched before tagging).
- `App : Application` calls `CrashMonitor.init(...)` with the demo app's API key.
- Single screen with buttons: **Crash — NPE** · **Crash — IllegalState** · **Crash on background thread** · **Handled error (logException)** · **Add breadcrumb** · **Set custom key** · **Flush now** — plus a status line showing `pendingReportCount()` and the install id.
- Demo script: press a crash button → app dies → reopen → status shows queue drained → portal shows the issue with +1 event; pressing the same crash button on two different emulators shows `user_count = 2` on **one** issue (the grouping money-shot).

---

## 7. Web portal (deliverable 7)

Served by the same Flask app at `/portal` (files in `api/portal/`) — one deployment, no CORS, one URL to submit. Vanilla HTML/JS/CSS + **Chart.js from CDN** (no build step), calling the admin API with `X-Admin-Key` from a login screen (key kept in `localStorage`; every API call 401s cleanly back to login).

Pages:
1. **Login** — enter admin key.
2. **Apps** — list with health summary; create app (modal shows the generated API key once); delete app.
3. **App dashboard** — overview cards (events, open issues, affected users, crash-free users %, last 24 h), crashes-over-time line chart, breakdown bar/pie switchable by app version / OS version / device model, and the **issues table**: title (`exception_type` @ `location`), sample message, events, users, first/last seen, fatal/non-fatal, status — sortable, filterable by status/version. This is the "which bugs hit how many users on which versions and devices" view.
4. **Issue detail** — full stack trace (monospace viewer), per-issue timeseries + breakdowns, occurrence list, and actions: resolve / ignore / reopen / delete.

---

## 8. Documentation (deliverable 4) & README (deliverable 5)

- `docs/` published via GitHub Pages (Settings → Pages → `main` / `docs`), default Jekyll theme, linked prominently from the README. Contents as in the tree above: getting-started (SDK in 5 minutes), library reference, API reference (tables + curl + link to the **live Swagger** `/apidocs`), data model + fingerprinting explainer, portal guide with screenshots.
- README: project pitch, architecture diagram, component links (docs site, live API, portal, JitPack badge, Swagger), quick-start for both SDK and API, screenshots of portal + demo app, license note.
- Postman collection committed at `api/postman/` (course guide covers Postman testing; also handy for grading).

---

## 9. Phased build order → 7 deliverables

Order front-loads the two external-infrastructure risks (Vercel+Atlas, JitPack) so failures surface in week one, not submission week.

**Phase 0 — Scaffold (all deliverables).**
Root Gradle project with empty `crashmonitor` + `app` modules building green; `api/` skeleton (`app.py` hello + Swagger); `docs/` stub; `.gitignore`; `jitpack.yml`.
*Exit:* `./gradlew assemble` passes; `flask run` serves `/` and `/apidocs`.

**Phase 1 — API core (deliverable 1).**
`MongoConnectionHolder` → Atlas cluster (per course guide); apps CRUD + auth decorators; fingerprint service + pytest; `/api/v1/crashes` ingest with the 3-write grouping path; issues endpoints; Flasgger docs on every route; `seed.py`; Postman collection; **deploy to Vercel now** (Root Directory `api/`, env vars, Atlas allow-all).
*Exit:* curl/Postman against the **live** URL: register app → post 2 identical + 1 different crash → issues shows counts 2 and 1.

**Phase 2 — Android library (deliverable 2).**
Models + ReportFactory; ReportStore (disk queue) + unit tests; CrashHandler; Uploader (Retrofit against live API); public facade + config; consumer proguard rules; publish `0.1.0` tag and **verify the JitPack build immediately**.
*Exit:* a throwaway project consuming `com.github.BenAlaf:crash-monitoring-sdk:0.1.0` crashes, relaunches, and the event appears in Atlas.

**Phase 3 — Demo app (deliverable 3).**
Buttons per §6, status line, `App.onCreate` init; switch to JitPack coordinate before tagging.
*Exit:* full loop crash → relaunch → portal-visible on a physical device and an emulator; grouping shows one issue, two users.

**Phase 4 — Portal (deliverable 7).**
Stats aggregation endpoints; login + apps + dashboard + issue detail pages; Chart.js charts; issue actions (resolve/ignore/delete).
*Exit:* full CRUD via browser with auth; seeded data renders all charts.

**Phase 5 — Sessions & crash-free metric (enhances deliverables 1, 2, 7).**
`sessions` collection + `POST /api/v1/sessions`; fire-and-forget session ping in `CrashMonitor.init()`; overview stats extended with crash-free users %; portal card. Isolated by design — if the schedule slips, this phase can be dropped without touching any other.
*Exit:* two emulators launch the demo app → overview shows 2 session users; crash one of them → crash-free card drops below 100 % with the right numbers.

**Phase 6 — Docs, README, hardening (deliverables 4, 5, 6).**
`docs/` content + enable Pages; README with diagram, badges, links, screenshots; payload caps + error paths re-checked; E2E test matrix (airplane-mode crash → reconnect → upload; batch upload; 401s; cascade delete); tag **`1.0.0`**; presentation dry-run with the §6 demo script.
*Exit:* all 7 deliverables checked against the assignment spec; fresh-clone integration test using only README instructions.

**Stretch (only if time remains):** WorkManager connectivity-constrained upload retry · TTL retention on `events` / `sessions` · ANR watchdog.

---

## 10. Resolved decisions (confirmed at plan review, 2026-07-02)

1. **Naming** — library module `crashmonitor`, facade `CrashMonitor`, Kotlin package `com.benalaf.crashmonitor`, repo stays `crash-monitoring-sdk`. A functional name is self-documenting for grading. GitHub username confirmed as **`BenAlaf`** (remote already set to `github.com/BenAlaf/crash-monitoring-sdk`), so the JitPack coordinate is `com.github.BenAlaf:crash-monitoring-sdk:<tag>`.
2. **Portal auth** — single admin key from the `ADMIN_KEY` env var, entered on a login page and sent as `X-Admin-Key`. Together with the per-app API keys this gives two real roles (admin: everything; SDK: ingest-only for its own app), satisfying the "authentication and authorization" requirement. Username/password + JWT explicitly out of scope.
3. **Fingerprint** — keep the opinionated recipe (root-cause type + in-app `class#method` frames; no line numbers, no messages). Line numbers would split one bug into two issues after any edit above it; the rare collision (two bugs, same type, same method) is an accepted trade-off, documented in `docs/data-model.md` and used as a presentation talking point.
4. **Batch ingest** — kept. `POST /api/v1/crashes` accepts one object or an array (≤ 20); the uploader drains its whole queue in a single request, which matters on serverless cold starts.
5. **Sessions / crash-free users %** — promoted from stretch to committed scope (Phase 5). It supplies the denominator that turns "37 affected users" into "99.6 % crash-free" and covers the assignment slide's session/usage-data bullet. Isolated, so it can be cut late without ripple effects.
