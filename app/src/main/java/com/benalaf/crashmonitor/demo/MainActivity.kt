package com.benalaf.crashmonitor.demo

import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.benalaf.crashmonitor.CrashMonitor
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var statusLabel: TextView
    private var breadcrumbCounter = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        statusLabel = findViewById(R.id.main_LBL_status)

        findViewById<Button>(R.id.main_BTN_crash_npe).setOnClickListener {
            CrashMonitor.addBreadcrumb("tapped: Crash (NullPointerException)")
            crashWithNullPointer()
        }
        findViewById<Button>(R.id.main_BTN_crash_state).setOnClickListener {
            CrashMonitor.addBreadcrumb("tapped: Crash (IllegalStateException)")
            crashWithIllegalState()
        }
        findViewById<Button>(R.id.main_BTN_crash_background).setOnClickListener {
            CrashMonitor.addBreadcrumb("tapped: Crash on background thread")
            crashOnBackgroundThread()
        }
        findViewById<Button>(R.id.main_BTN_non_fatal).setOnClickListener {
            CrashMonitor.logException(
                IOException("Demo: sync request timed out (handled error)"),
                mapOf("endpoint" to "/api/sync", "retry" to "scheduled")
            )
            toast("Non-fatal error reported")
            refreshStatusSoon()
        }
        findViewById<Button>(R.id.main_BTN_breadcrumb).setOnClickListener {
            breadcrumbCounter++
            CrashMonitor.addBreadcrumb("manual breadcrumb #$breadcrumbCounter")
            toast("Breadcrumb #$breadcrumbCounter added")
        }
        findViewById<Button>(R.id.main_BTN_custom_key).setOnClickListener {
            CrashMonitor.setCustomKey("demo_mode", "enabled")
            CrashMonitor.setCustomKey("cart_size", "3")
            toast("Custom keys set")
        }
        findViewById<Button>(R.id.main_BTN_flush).setOnClickListener {
            CrashMonitor.flush()
            toast("Upload requested")
            refreshStatusSoon()
        }
    }

    override fun onResume() {
        super.onResume()
        refreshStatus()
        refreshStatusSoon()
    }

    private fun refreshStatus() {
        statusLabel.text = getString(
            R.string.status_format,
            CrashMonitor.SDK_VERSION,
            CrashMonitor.pendingReportCount(),
            CrashMonitor.installId() ?: "-",
        )
    }

    /** The uploader works in the background — check again once it had a moment. */
    private fun refreshStatusSoon() {
        Handler(Looper.getMainLooper()).postDelayed({ refreshStatus() }, 2000)
    }

    private fun crashWithNullPointer() {
        val user: String? = null
        user!!.length
    }

    private fun crashWithIllegalState() {
        throw IllegalStateException("Demo: checkout attempted with an empty cart")
    }

    private fun crashOnBackgroundThread() {
        Thread({
            throw RuntimeException("Demo: worker thread exploded")
        }, "demo-worker").start()
    }

    private fun toast(message: String) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
    }
}
