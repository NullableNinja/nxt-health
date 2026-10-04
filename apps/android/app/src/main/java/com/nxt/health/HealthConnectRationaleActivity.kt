package com.nxt.health

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

/**
 * Privacy explanation shown when Health Connect asks what N//XT does with health data.
 * Keep this text aligned with the Play Console Health Connect declaration before release.
 */
class HealthConnectRationaleActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(
            TextView(this).apply {
                text = "N//XT reads the health data types you approve from Android Health Connect to show your activity, body, heart, and sleep records in this app. The data is kept on this device and is not uploaded by this integration. You can revoke access at any time in Health Connect settings."
                setPadding(48, 48, 48, 48)
                textSize = 18f
            },
        )
    }
}
