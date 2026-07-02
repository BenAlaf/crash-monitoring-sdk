package com.benalaf.crashmonitor

/**
 * Configuration for [CrashMonitor.init]. Only the API key is required:
 *
 * ```
 * CrashMonitor.init(this, CrashMonitorConfig.Builder("your-api-key").build())
 * ```
 */
class CrashMonitorConfig private constructor(
    val apiKey: String,
    val baseUrl: String,
    val enabled: Boolean,
    val maxPendingReports: Int,
) {

    class Builder(private val apiKey: String) {
        private var baseUrl: String = DEFAULT_BASE_URL
        private var enabled: Boolean = true
        private var maxPendingReports: Int = DEFAULT_MAX_PENDING

        /** Override the backend URL (e.g. for a self-hosted server). */
        fun baseUrl(url: String) = apply { this.baseUrl = if (url.endsWith('/')) url else "$url/" }

        /** Set to false to disable the SDK entirely (e.g. in debug builds). */
        fun enabled(value: Boolean) = apply { this.enabled = value }

        /** Maximum queued reports kept on disk; oldest are dropped beyond this. */
        fun maxPendingReports(value: Int) = apply { this.maxPendingReports = value.coerceIn(1, 500) }

        fun build(): CrashMonitorConfig {
            require(apiKey.isNotBlank()) { "CrashMonitor: apiKey must not be blank" }
            return CrashMonitorConfig(apiKey, baseUrl, enabled, maxPendingReports)
        }
    }

    companion object {
        const val DEFAULT_BASE_URL: String = "https://crash-monitoring-sdk.vercel.app/"
        const val DEFAULT_MAX_PENDING: Int = 50
    }
}
