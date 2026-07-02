package com.benalaf.crashmonitor.internal

import android.content.Context
import com.benalaf.crashmonitor.CrashMonitorConfig
import com.benalaf.crashmonitor.model.Breadcrumb
import com.google.gson.GsonBuilder
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** Internal engine behind the [com.benalaf.crashmonitor.CrashMonitor] facade. */
internal class CrashMonitorCore(context: Context, config: CrashMonitorConfig) {

    private val appContext = context.applicationContext

    val installId: String = loadOrCreateInstallId()

    private val store = ReportStore(
        directory = File(appContext.filesDir, QUEUE_DIR),
        maxPendingReports = config.maxPendingReports,
    )
    private val factory = ReportFactory(Snapshot.from(appContext), installId)

    private val retrofit = Retrofit.Builder()
        .baseUrl(config.baseUrl)
        .addConverterFactory(GsonConverterFactory.create(GsonBuilder().setLenient().create()))
        .build()
    private val uploader = Uploader(store, retrofit.create(CrashApi::class.java), config.apiKey)

    private val breadcrumbs = ArrayDeque<Breadcrumb>()
    private val customKeys = ConcurrentHashMap<String, String>()

    /** Installs the crash handler (idempotent) and drains reports left by previous runs. */
    fun start() {
        val previous = Thread.getDefaultUncaughtExceptionHandler()
        if (previous !is CrashHandler) {
            Thread.setDefaultUncaughtExceptionHandler(CrashHandler(previous, ::onUncaughtException))
        }
        uploader.requestDrain()
    }

    private fun onUncaughtException(thread: Thread, throwable: Throwable) {
        // crash path: synchronous disk write only — no network, no new threads
        store.persist(
            factory.build(throwable, thread.name, isFatal = true, breadcrumbsSnapshot(), customKeys.toMap())
        )
    }

    fun logException(throwable: Throwable, custom: Map<String, String>) {
        store.persist(
            factory.build(
                throwable,
                Thread.currentThread().name,
                isFatal = false,
                breadcrumbsSnapshot(),
                customKeys.toMap() + custom,
            )
        )
        uploader.requestDrain()
    }

    fun addBreadcrumb(message: String) {
        synchronized(breadcrumbs) {
            breadcrumbs.addLast(Breadcrumb(ts = Instant.now().toString(), message = message.take(MAX_BREADCRUMB_LENGTH)))
            while (breadcrumbs.size > MAX_BREADCRUMBS) breadcrumbs.removeFirst()
        }
    }

    fun setCustomKey(key: String, value: String) {
        customKeys[key.take(MAX_KEY_LENGTH)] = value.take(MAX_VALUE_LENGTH)
    }

    fun flush() = uploader.requestDrain()

    fun pendingReportCount(): Int = store.pendingCount()

    private fun breadcrumbsSnapshot(): List<Breadcrumb> = synchronized(breadcrumbs) { breadcrumbs.toList() }

    private fun loadOrCreateInstallId(): String {
        val prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getString(KEY_INSTALL_ID, null) ?: UUID.randomUUID().toString().also { id ->
            prefs.edit().putString(KEY_INSTALL_ID, id).apply()
        }
    }

    private companion object {
        const val QUEUE_DIR = "crashmonitor/queue"
        const val PREFS_NAME = "crashmonitor_prefs"
        const val KEY_INSTALL_ID = "install_id"
        const val MAX_BREADCRUMBS = 30
        const val MAX_BREADCRUMB_LENGTH = 500
        const val MAX_KEY_LENGTH = 64
        const val MAX_VALUE_LENGTH = 500
    }
}
