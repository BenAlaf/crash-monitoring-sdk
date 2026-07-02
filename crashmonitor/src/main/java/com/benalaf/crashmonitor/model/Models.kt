package com.benalaf.crashmonitor.model

import com.google.gson.annotations.SerializedName

/** Wire models — field names must match the CrashMonitor API contract (see /apidocs). */

data class CrashReport(
    @SerializedName("install_id") val installId: String,
    @SerializedName("timestamp") val timestamp: String,
    @SerializedName("is_fatal") val isFatal: Boolean,
    @SerializedName("app") val app: AppInfo,
    @SerializedName("device") val device: DeviceInfo,
    @SerializedName("thread") val thread: String,
    @SerializedName("exception") val exception: ExceptionInfo,
    @SerializedName("raw_stack_trace") val rawStackTrace: String,
    @SerializedName("breadcrumbs") val breadcrumbs: List<Breadcrumb>,
    @SerializedName("custom") val custom: Map<String, String>,
)

data class AppInfo(
    @SerializedName("package_name") val packageName: String,
    @SerializedName("version_name") val versionName: String,
    @SerializedName("version_code") val versionCode: Long,
)

data class DeviceInfo(
    @SerializedName("manufacturer") val manufacturer: String,
    @SerializedName("model") val model: String,
    @SerializedName("os_version") val osVersion: String,
    @SerializedName("sdk_int") val sdkInt: Int,
)

data class ExceptionInfo(
    @SerializedName("type") val type: String,
    @SerializedName("message") val message: String?,
    @SerializedName("frames") val frames: List<Frame>,
    @SerializedName("cause") val cause: ExceptionInfo?,
)

data class Frame(
    @SerializedName("cls") val cls: String,
    @SerializedName("method") val method: String,
    @SerializedName("file") val file: String?,
    @SerializedName("line") val line: Int,
)

data class Breadcrumb(
    @SerializedName("ts") val ts: String,
    @SerializedName("message") val message: String,
)

data class IngestResult(
    @SerializedName("event_id") val eventId: String,
    @SerializedName("issue_id") val issueId: String,
    @SerializedName("fingerprint") val fingerprint: String,
)
