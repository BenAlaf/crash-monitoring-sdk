# Getting started

Integrate CrashMonitor into an Android app in three steps (~5 minutes).

## Requirements

- Android **minSdk 26** (Android 8.0) or higher
- Kotlin or Java project with Gradle

## Step 1 — Get an API key

Open the [portal](https://crash-monitoring-sdk.vercel.app/portal/) → **New app** → enter a display name and your app's **package name** (must match your `applicationId` exactly). Copy the generated **API key** — it identifies your app to the backend and can only ingest reports for its own package.

## Step 2 — Add the library

Add the JitPack repository to `settings.gradle.kts`:

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }
    }
}
```

Add the dependency to your app module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.github.BenAlaf:crash-monitoring-sdk:1.0.0")
}
```

> The SDK brings Retrofit 2 + Gson transitively and declares the `INTERNET` permission in its own manifest — nothing else to configure.

## Step 3 — Initialize

Create (or extend) your `Application` class and initialize as early as possible:

```kotlin
import android.app.Application
import com.benalaf.crashmonitor.CrashMonitor
import com.benalaf.crashmonitor.CrashMonitorConfig

class App : Application() {
    override fun onCreate() {
        super.onCreate()
        CrashMonitor.init(
            this,
            CrashMonitorConfig.Builder("your-api-key").build()
        )
    }
}
```

Register it in `AndroidManifest.xml`:

```xml
<application android:name=".App" …>
```

**Done.** Uncaught exceptions are now captured; on the next app launch they upload and appear in the portal, grouped into issues.

## Verify the integration

1. Throw a test crash somewhere reachable:

   ```kotlin
   throw RuntimeException("CrashMonitor integration test")
   ```

2. Run the app, trigger the crash, and **reopen the app** (reports upload on launch — a dying process never performs network I/O).
3. Open your app's dashboard in the [portal](https://crash-monitoring-sdk.vercel.app/portal/) — the issue appears within seconds.

## Going further

```kotlin
// Report a handled error (uploads right away, no crash needed):
try {
    syncOrders()
} catch (e: IOException) {
    CrashMonitor.logException(e, mapOf("endpoint" to "/orders/sync"))
}

// Leave context for the next report (last 30 kept, ring buffer):
CrashMonitor.addBreadcrumb("user tapped checkout")

// Attach key/value context to every future report from this process:
CrashMonitor.setCustomKey("ab_test_group", "B")
```

Behavior worth knowing:

- **Offline**: reports wait on disk (up to `maxPendingReports`, default 50 — oldest dropped beyond that) and upload on a later launch with connectivity.
- **Sessions**: `init()` sends an anonymous session ping that powers the *crash-free users* metric. No personal data is collected — the user identity is a random per-install UUID.
- **Safety**: every public method is exception-safe; the SDK never crashes or blocks the host app (crash-time disk write is synchronous by design and takes milliseconds).

Full API: [Library reference](library-reference.md).
