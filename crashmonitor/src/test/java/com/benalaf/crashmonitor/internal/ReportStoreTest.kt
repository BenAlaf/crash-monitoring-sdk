package com.benalaf.crashmonitor.internal

import com.benalaf.crashmonitor.model.AppInfo
import com.benalaf.crashmonitor.model.CrashReport
import com.benalaf.crashmonitor.model.DeviceInfo
import com.benalaf.crashmonitor.model.ExceptionInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class ReportStoreTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private fun store(max: Int = 50) = ReportStore(File(tmp.root, "queue"), max)

    private fun report(message: String = "boom") = CrashReport(
        installId = "install-1",
        timestamp = "2026-07-02T14:00:00Z",
        isFatal = true,
        app = AppInfo("com.example", "1.0.0", 1L),
        device = DeviceInfo("Google", "Pixel 8", "15", 35),
        thread = "main",
        exception = ExceptionInfo("java.lang.RuntimeException", message, emptyList(), null),
        rawStackTrace = "java.lang.RuntimeException: $message",
        breadcrumbs = emptyList(),
        custom = emptyMap(),
    )

    @Test
    fun `persist writes a json file and no tmp leftovers`() {
        val store = store()
        val file = store.persist(report())

        assertNotNull(file)
        assertTrue(file!!.name.endsWith(".json"))
        assertEquals(1, store.pendingCount())
        assertTrue(file.parentFile!!.listFiles { f -> f.name.endsWith(".tmp") }!!.isEmpty())
    }

    @Test
    fun `round trip preserves the report`() {
        val store = store()
        val file = store.persist(report("specific message"))!!

        val loaded = store.read(file)

        assertNotNull(loaded)
        assertEquals("specific message", loaded!!.exception.message)
        assertEquals("install-1", loaded.installId)
        assertTrue(loaded.isFatal)
    }

    @Test
    fun `listPending returns oldest first`() {
        val store = store()
        val first = store.persist(report("first"))!!
        Thread.sleep(5)
        val second = store.persist(report("second"))!!

        val pending = store.listPending()

        assertEquals(listOf(first, second), pending)
    }

    @Test
    fun `cap drops the oldest reports`() {
        val store = store(max = 3)
        repeat(5) {
            store.persist(report("r$it"))
            Thread.sleep(5)
        }

        val remaining = store.listPending().mapNotNull { store.read(it)?.exception?.message }

        assertEquals(listOf("r2", "r3", "r4"), remaining)
    }

    @Test
    fun `corrupt file reads as null`() {
        val store = store()
        val file = store.persist(report())!!
        file.writeText("{ not valid json !!!")

        assertNull(store.read(file))
    }

    @Test
    fun `delete removes files`() {
        val store = store()
        store.persist(report())
        store.delete(store.listPending())

        assertEquals(0, store.pendingCount())
    }

    @Test
    fun `empty directory yields empty list`() {
        assertEquals(emptyList<File>(), store().listPending())
    }
}
