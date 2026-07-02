package com.benalaf.crashmonitor.internal

import com.benalaf.crashmonitor.model.CrashReport
import com.google.gson.Gson
import java.io.File
import java.util.UUID

/**
 * Durable disk queue: one JSON file per report under the app's private files dir.
 *
 * Written for the crash path, so every operation is synchronous, exception-free
 * (returns null/false instead of throwing) and uses write-to-temp + atomic rename —
 * the uploader can never observe a half-written file. Filenames start with the
 * epoch-millis timestamp so lexicographic order == chronological order.
 */
internal class ReportStore(
    private val directory: File,
    private val maxPendingReports: Int,
) {
    private val gson = Gson()

    fun persist(report: CrashReport): File? = try {
        directory.mkdirs()
        val name = "${System.currentTimeMillis()}_${UUID.randomUUID()}"
        val tmp = File(directory, "$name.tmp")
        val final = File(directory, "$name.json")

        tmp.writeText(gson.toJson(report))
        if (!tmp.renameTo(final)) {
            tmp.delete()
            null
        } else {
            enforceCap()
            final
        }
    } catch (_: Throwable) {
        null
    }

    /** Pending report files, oldest first. */
    fun listPending(): List<File> = try {
        directory.listFiles { file -> file.name.endsWith(".json") }
            ?.sortedBy { it.name }
            ?: emptyList()
    } catch (_: Throwable) {
        emptyList()
    }

    fun read(file: File): CrashReport? = try {
        gson.fromJson(file.readText(), CrashReport::class.java)
    } catch (_: Throwable) {
        null
    }

    fun delete(files: List<File>) {
        for (file in files) {
            try {
                file.delete()
            } catch (_: Throwable) {
            }
        }
    }

    fun pendingCount(): Int = listPending().size

    private fun enforceCap() {
        val pending = listPending()
        if (pending.size > maxPendingReports) {
            delete(pending.take(pending.size - maxPendingReports))
        }
    }
}
