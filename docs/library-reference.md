# Library reference

Package `com.benalaf.crashmonitor` · artifact `com.github.BenAlaf:crash-monitoring-sdk` · minSdk 26.

The public surface is deliberately small: one facade object and one config builder. Everything else is `internal`.

## `CrashMonitor` (object)

All methods are safe to call from any thread and **never throw** — internal failures are logged under the `CrashMonitor` tag and suppressed.

| Member | Description |
|---|---|
| `SDK_VERSION: String` | Library version constant. |
| `init(context, config)` | Installs the crash handler (idempotent — repeated calls are ignored), starts draining any reports left by previous runs, and sends the session ping. Call in `Application.onCreate`. |
| `logException(throwable, custom = emptyMap())` | Records a **handled** (non-fatal) error with optional extra key/values. Persisted to disk first, then uploaded right away in the background. |
| `addBreadcrumb(message)` | Adds a timestamped note to a ring buffer (last **30** kept, 500 chars each). Breadcrumbs ride along on every subsequent report. |
| `setCustomKey(key, value)` | Attaches a key/value to every future report from this process (max 64/500 chars). |
| `flush()` | Requests an immediate upload attempt of everything queued. |
| `pendingReportCount(): Int` | Number of reports currently waiting on disk. |
| `installId(): String?` | The anonymous per-install UUID used as the "user" identity (null before `init`). |

## `CrashMonitorConfig.Builder`

```kotlin
CrashMonitorConfig.Builder("your-api-key")   // required
    .baseUrl("https://your-server.example/") // optional — self-hosted backend
    .enabled(BuildConfig.RELEASE)            // optional — e.g. disable in debug builds
    .maxPendingReports(50)                   // optional — disk queue cap (1..500)
    .build()
```

| Option | Default | Meaning |
|---|---|---|
| `apiKey` *(constructor)* | — | The app's key from the portal. Must be non-blank. |
| `baseUrl(url)` | the hosted backend | Point the SDK at another CrashMonitor server. Trailing `/` added automatically. |
| `enabled(flag)` | `true` | `false` turns `init` into a no-op — nothing is captured or sent. |
| `maxPendingReports(n)` | `50` | Cap on queued reports; the **oldest** are dropped beyond it. |

## Behavior contract

**At crash time** the SDK builds the report in memory and writes **one JSON file synchronously** to `filesDir/crashmonitor/queue/` (write-to-temp, then atomic rename — a half-written file can never be read back). It then delegates to the previously installed exception handler, so the system crash dialog and process teardown are exactly as without the SDK. **No network I/O ever happens on the crash path.**

**At upload time** (next `init`, `logException`, or `flush`) a single background thread drains the queue in batches of up to 20 reports per request:

| Server response | Action |
|---|---|
| 2xx | files deleted — done |
| 400 | files deleted (a malformed report would poison the queue forever) |
| 401 / 403 | files kept, drain stops (fix the API key; data uploads later) |
| 5xx / network error | files kept, drain stops (retried on next launch) |

**What a report contains:** exception chain (type, message, frames — capped at depth 5 / 64 frames), raw stack trace (16 KB cap), thread name, timestamp, app package + version, device manufacturer/model/OS, the anonymous install id, breadcrumbs, and custom keys.

**Privacy:** no personal data is collected. The only identity is a random UUID generated on first launch and stored in the app's private `SharedPreferences`.

## Java interop

The facade is `@JvmStatic` throughout:

```java
CrashMonitor.init(this, new CrashMonitorConfig.Builder("key").build());
CrashMonitor.logException(new IOException("sync failed"));
```
