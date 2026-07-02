package com.benalaf.crashmonitor.internal

import com.benalaf.crashmonitor.model.ExceptionInfo
import com.benalaf.crashmonitor.model.Frame

/**
 * Pure Throwable → wire-model conversion. No Android dependencies so it is
 * fully unit-testable on the JVM.
 */
internal object ThrowableParser {

    const val MAX_CAUSE_DEPTH = 5
    const val MAX_FRAMES = 64
    const val MAX_MESSAGE_LENGTH = 2048
    const val MAX_RAW_TRACE_BYTES = 16 * 1024

    fun toExceptionInfo(throwable: Throwable, depth: Int = 0): ExceptionInfo {
        val cause = throwable.cause
        return ExceptionInfo(
            type = throwable.javaClass.name,
            message = throwable.message?.take(MAX_MESSAGE_LENGTH),
            frames = throwable.stackTrace.take(MAX_FRAMES).map { element ->
                Frame(
                    cls = element.className,
                    method = element.methodName,
                    file = element.fileName,
                    line = element.lineNumber,
                )
            },
            cause = if (cause != null && cause !== throwable && depth < MAX_CAUSE_DEPTH) {
                toExceptionInfo(cause, depth + 1)
            } else {
                null
            },
        )
    }

    fun rawStackTrace(throwable: Throwable): String =
        throwable.stackTraceToString().take(MAX_RAW_TRACE_BYTES)
}
