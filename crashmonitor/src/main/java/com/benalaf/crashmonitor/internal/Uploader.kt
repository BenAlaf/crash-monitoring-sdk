package com.benalaf.crashmonitor.internal

import android.util.Log
import java.io.File
import java.util.concurrent.Executors

/**
 * Drains the disk queue on a single background thread: batches of up to
 * [MAX_BATCH] reports per request, files deleted only after a 2xx response.
 *
 * Failure policy per batch:
 *  - network error / 5xx → keep files, stop (retried on next launch/trigger)
 *  - 400 → delete files (malformed reports would poison the queue forever)
 *  - 401/403 → keep files, stop (API-key misconfiguration; data uploads once fixed)
 */
internal class Uploader(
    private val store: ReportStore,
    private val api: CrashApi,
    private val apiKey: String,
) {
    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "crashmonitor-uploader").apply { isDaemon = true }
    }

    fun requestDrain() {
        executor.execute { drain() }
    }

    private fun drain() {
        store.listPending().chunked(MAX_BATCH).forEach { batch ->
            val readable = mutableListOf<File>()
            val reports = batch.mapNotNull { file ->
                store.read(file)?.also { readable.add(file) }
            }
            store.delete(batch - readable.toSet()) // corrupt files can never upload

            if (reports.isEmpty()) return@forEach

            try {
                val response = api.uploadReports(apiKey, reports).execute()
                when {
                    response.isSuccessful -> store.delete(readable)
                    response.code() == 400 -> {
                        Log.w(TAG, "Server rejected ${readable.size} report(s) as invalid; dropping them")
                        store.delete(readable)
                    }
                    else -> {
                        Log.w(TAG, "Upload failed with HTTP ${response.code()}; will retry later")
                        return
                    }
                }
            } catch (e: Exception) {
                Log.d(TAG, "Upload attempt failed (offline?): ${e.message}")
                return
            }
        }
    }

    private companion object {
        const val TAG = "CrashMonitor"
        const val MAX_BATCH = 20
    }
}
