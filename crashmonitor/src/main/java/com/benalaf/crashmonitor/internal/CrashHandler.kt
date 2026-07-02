package com.benalaf.crashmonitor.internal

/**
 * Uncaught-exception hook. Persists the report synchronously via [onCrash], then
 * ALWAYS delegates to the previously-installed handler so the OS crash dialog and
 * process teardown behave exactly as without the SDK. Never uploads — the process
 * is dying; the report is sent on the next launch.
 */
internal class CrashHandler(
    private val previousHandler: Thread.UncaughtExceptionHandler?,
    private val onCrash: (Thread, Throwable) -> Unit,
) : Thread.UncaughtExceptionHandler {

    override fun uncaughtException(thread: Thread, throwable: Throwable) {
        try {
            onCrash(thread, throwable)
        } catch (_: Throwable) {
            // the SDK must never mask or replace the original crash
        } finally {
            previousHandler?.uncaughtException(thread, throwable)
        }
    }
}
