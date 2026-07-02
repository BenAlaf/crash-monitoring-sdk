package com.benalaf.crashmonitor.demo

import android.app.Application
import com.benalaf.crashmonitor.CrashMonitor
import com.benalaf.crashmonitor.CrashMonitorConfig

class App : Application() {

    override fun onCreate() {
        super.onCreate()

        // Init as early as possible so the very first crash is caught.
        // The API key identifies this app on the CrashMonitor backend; it can
        // only ingest reports for its own package, so it is safe to ship.
        CrashMonitor.init(
            this,
            CrashMonitorConfig.Builder(CRASH_MONITOR_API_KEY).build()
        )
    }

    companion object {
        const val CRASH_MONITOR_API_KEY = "8d729cb2-188a-4619-b356-5d6926b6d50e"
    }
}
