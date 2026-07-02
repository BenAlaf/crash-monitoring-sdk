package com.benalaf.crashmonitor

import android.content.Context
import android.util.Log
import com.benalaf.crashmonitor.internal.CrashMonitorCore

/**
 * CrashMonitor — crash & error monitoring for Android.
 *
 * Initialize once, as early as possible (ideally in [android.app.Application.onCreate]):
 * ```
 * CrashMonitor.init(this, CrashMonitorConfig.Builder("your-api-key").build())
 * ```
 *
 * How it works:
 *  1. Uncaught exceptions are written to a private disk queue *synchronously*, before
 *     the process dies; the OS crash flow is untouched.
 *  2. On the next [init] (next app launch) the queue is uploaded in one batch and
 *     grouped into issues server-side. No network → reports simply wait for a later launch.
 *
 * All public methods are safe to call from any thread and never throw.
 */
object CrashMonitor {

    const val SDK_VERSION: String = "1.0.0"

    private const val TAG = "CrashMonitor"

    @Volatile
    private var core: CrashMonitorCore? = null

    /** Initialize the SDK. Subsequent calls are ignored. */
    @JvmStatic
    fun init(context: Context, config: CrashMonitorConfig) {
        if (!config.enabled) {
            Log.i(TAG, "Disabled by configuration; not initializing")
            return
        }
        synchronized(this) {
            if (core != null) {
                Log.w(TAG, "Already initialized; ignoring repeated init()")
                return
            }
            try {
                core = CrashMonitorCore(context, config).also { it.start() }
                Log.i(TAG, "Initialized (v$SDK_VERSION)")
            } catch (t: Throwable) {
                Log.e(TAG, "Initialization failed; SDK inactive", t)
            }
        }
    }

    /** Record a handled (non-fatal) error. Uploaded in the background right away. */
    @JvmStatic
    @JvmOverloads
    fun logException(throwable: Throwable, custom: Map<String, String> = emptyMap()) {
        runSafely { it.logException(throwable, custom) }
    }

    /** Add a breadcrumb — a short note attached to every future report (last 30 kept). */
    @JvmStatic
    fun addBreadcrumb(message: String) {
        runSafely { it.addBreadcrumb(message) }
    }

    /** Attach a key/value to every future report from this process. */
    @JvmStatic
    fun setCustomKey(key: String, value: String) {
        runSafely { it.setCustomKey(key, value) }
    }

    /** Force an upload attempt of any queued reports now. */
    @JvmStatic
    fun flush() {
        runSafely { it.flush() }
    }

    /** Number of reports currently waiting on disk. */
    @JvmStatic
    fun pendingReportCount(): Int {
        var count = 0
        runSafely { count = it.pendingReportCount() }
        return count
    }

    /** The anonymous per-install id used as the "user" identity, or null before init. */
    @JvmStatic
    fun installId(): String? {
        var id: String? = null
        runSafely { id = it.installId }
        return id
    }

    private inline fun runSafely(block: (CrashMonitorCore) -> Unit) {
        val instance = core ?: run {
            Log.w(TAG, "Not initialized; call CrashMonitor.init() first")
            return
        }
        try {
            block(instance)
        } catch (t: Throwable) {
            Log.e(TAG, "Internal error (suppressed — the SDK never crashes the host app)", t)
        }
    }
}
