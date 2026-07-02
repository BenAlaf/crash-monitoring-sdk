# CrashMonitor SDK

**Crash & error monitoring for Android — a mini-Sentry.** An Android library catches uncaught exceptions and uploads them, a Flask backend groups identical crashes into issues via fingerprinting, and a web portal shows which bugs hit how many users on which app versions and devices.

| | |
|---|---|
| Source | https://github.com/BenAlaf/crash-monitoring-sdk |
| Live portal | https://crash-monitoring-sdk.vercel.app/portal/ |
| Live API + Swagger | https://crash-monitoring-sdk.vercel.app/apidocs/ |
| Library | `com.github.BenAlaf:crash-monitoring-sdk` on [JitPack](https://jitpack.io/#BenAlaf/crash-monitoring-sdk) |

## Guides

1. **[Getting started](getting-started.md)** — integrate the SDK in 5 minutes
2. **[Library reference](library-reference.md)** — the public Kotlin API
3. **[API reference](api-reference.md)** — every endpoint, auth model, curl examples
4. **[Data model & fingerprinting](data-model.md)** — how grouping works and why
5. **[Portal guide](portal-guide.md)** — dashboards, issue lifecycle, app management

## Architecture

```
┌─────────────────────────────┐
│ Android device              │
│ ┌─────────────────────────┐ │
│ │ Host app                │ │
│ │  └─ CrashMonitor SDK    │ │        HTTPS (X-API-Key)
│ │     ├─ CrashHandler ────┼─┼──┐  1. crash → write JSON to disk (sync)
│ │     ├─ Disk queue       │ │  │  2. next launch → upload batch
│ │     └─ Uploader ────────┼─┼──┼────────────┐
│ └─────────────────────────┘ │  │            ▼
└─────────────────────────────┘  │   ┌──────────────────────────────┐
                                 │   │ Flask API (Vercel)           │
┌─────────────────────────────┐  │   │  ├─ /api/v1/crashes  ingest  │
│ Developer's browser         │  │   │  │   └─ fingerprint → upsert │
│  Admin portal (/portal)     │──┼──▶│  ├─ /api/v1/sessions ingest  │
│  X-Admin-Key                │      │  ├─ /api/v1/apps     CRUD    │
└─────────────────────────────┘      │  ├─ /api/v1/…/issues CRUD    │
                                     │  ├─ /api/v1/…/stats  charts  │
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

**Capture-before-death.** A crashing process cannot be trusted to complete a network call, so the SDK never uploads during a crash. The report is written to a private disk queue synchronously; the queue is drained on the next launch. This one design decision also gives full offline support for free.

**Fingerprint grouping.** Every report is reduced server-side to a deterministic fingerprint (root-cause type + in-app `class#method` frames). All occurrences of the same bug — across users, app versions, and message variations — land in **one issue document** with atomic counters. The portal reads issues, never scans raw events.

Details: [Data model & fingerprinting](data-model.md).
