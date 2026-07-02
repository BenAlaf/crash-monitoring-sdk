package com.benalaf.crashmonitor.demo

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.benalaf.crashmonitor.CrashMonitor

class MainActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        findViewById<TextView>(R.id.main_LBL_status).text =
            getString(R.string.status_sdk_version, CrashMonitor.SDK_VERSION)
    }
}
