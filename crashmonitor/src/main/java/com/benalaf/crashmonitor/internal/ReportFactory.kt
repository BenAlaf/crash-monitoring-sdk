package com.benalaf.crashmonitor.internal

import com.benalaf.crashmonitor.model.Breadcrumb
import com.benalaf.crashmonitor.model.CrashReport
import java.time.Instant

/** Assembles a complete wire-ready [CrashReport] from a Throwable plus captured context. */
internal class ReportFactory(
    private val snapshot: Snapshot,
    private val installId: String,
) {

    fun build(
        throwable: Throwable,
        threadName: String,
        isFatal: Boolean,
        breadcrumbs: List<Breadcrumb>,
        custom: Map<String, String>,
    ): CrashReport = CrashReport(
        installId = installId,
        timestamp = Instant.now().toString(),
        isFatal = isFatal,
        app = snapshot.app,
        device = snapshot.device,
        thread = threadName,
        exception = ThrowableParser.toExceptionInfo(throwable),
        rawStackTrace = ThrowableParser.rawStackTrace(throwable),
        breadcrumbs = breadcrumbs,
        custom = custom,
    )
}
