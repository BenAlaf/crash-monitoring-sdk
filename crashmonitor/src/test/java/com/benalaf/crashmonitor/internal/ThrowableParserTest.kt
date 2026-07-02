package com.benalaf.crashmonitor.internal

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ThrowableParserTest {

    @Test
    fun `maps type, message and frames`() {
        val info = ThrowableParser.toExceptionInfo(IllegalStateException("fragment not attached"))

        assertEquals("java.lang.IllegalStateException", info.type)
        assertEquals("fragment not attached", info.message)
        assertTrue(info.frames.isNotEmpty())

        val top = info.frames.first()
        assertEquals(javaClass.name, top.cls)
        assertTrue(top.method.contains("maps type"))
        assertTrue(top.line > 0)
    }

    @Test
    fun `null message survives`() {
        val info = ThrowableParser.toExceptionInfo(NullPointerException())
        assertNull(info.message)
    }

    @Test
    fun `cause chain is preserved`() {
        val root = java.io.IOException("socket closed")
        val wrapped = RuntimeException("upload failed", root)

        val info = ThrowableParser.toExceptionInfo(wrapped)

        assertEquals("java.lang.RuntimeException", info.type)
        assertEquals("java.io.IOException", info.cause?.type)
        assertEquals("socket closed", info.cause?.message)
        assertNull(info.cause?.cause)
    }

    @Test
    fun `cause depth is capped`() {
        var throwable: Throwable = RuntimeException("level 0")
        repeat(10) { i -> throwable = RuntimeException("level ${i + 1}", throwable) }

        var info = ThrowableParser.toExceptionInfo(throwable)
        var depth = 0
        while (info.cause != null) {
            info = info.cause!!
            depth++
        }
        assertEquals(ThrowableParser.MAX_CAUSE_DEPTH, depth)
    }

    @Test
    fun `frames are capped`() {
        val throwable = RuntimeException("deep")
        throwable.stackTrace = Array(500) {
            StackTraceElement("com.example.Cls$it", "method$it", "File.kt", it)
        }
        val info = ThrowableParser.toExceptionInfo(throwable)
        assertEquals(ThrowableParser.MAX_FRAMES, info.frames.size)
    }

    @Test
    fun `long message is truncated`() {
        val info = ThrowableParser.toExceptionInfo(RuntimeException("x".repeat(10_000)))
        assertEquals(ThrowableParser.MAX_MESSAGE_LENGTH, info.message?.length)
    }

    @Test
    fun `raw stack trace is capped and contains cause`() {
        val wrapped = RuntimeException("outer", java.io.IOException("inner"))
        val raw = ThrowableParser.rawStackTrace(wrapped)

        assertTrue(raw.contains("java.lang.RuntimeException: outer"))
        assertTrue(raw.contains("Caused by"))
        assertTrue(raw.length <= ThrowableParser.MAX_RAW_TRACE_BYTES)
    }
}
