package com.benalaf.crashmonitor.internal

import android.content.Context
import android.os.Build
import com.benalaf.crashmonitor.model.AppInfo
import com.benalaf.crashmonitor.model.DeviceInfo

/**
 * App + device identity captured once at init — the crash handler must not
 * call PackageManager while the process is dying.
 */
internal data class Snapshot(
    val app: AppInfo,
    val device: DeviceInfo,
) {
    companion object {

        fun from(context: Context): Snapshot {
            @Suppress("DEPRECATION")
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)

            @Suppress("DEPRECATION")
            val versionCode =
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) packageInfo.longVersionCode
                else packageInfo.versionCode.toLong()

            return Snapshot(
                app = AppInfo(
                    packageName = context.packageName,
                    versionName = packageInfo.versionName ?: "unknown",
                    versionCode = versionCode,
                ),
                device = DeviceInfo(
                    manufacturer = Build.MANUFACTURER ?: "unknown",
                    model = Build.MODEL ?: "unknown",
                    osVersion = Build.VERSION.RELEASE ?: "unknown",
                    sdkInt = Build.VERSION.SDK_INT,
                ),
            )
        }
    }
}
