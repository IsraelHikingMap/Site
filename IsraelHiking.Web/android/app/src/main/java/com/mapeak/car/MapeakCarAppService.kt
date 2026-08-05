package com.mapeak.car

import android.content.pm.ApplicationInfo
import android.util.Log
import androidx.car.app.CarAppService
import androidx.car.app.R
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

class MapeakCarAppService : CarAppService() {
    override fun onCreateSession(): Session {
        Log.d(LOG_TAG, "Session created")
        return CarSession()
    }

    override fun onDestroy() {
        Log.d(LOG_TAG, "onDestroy")
        super.onDestroy()
    }

    override fun createHostValidator(): HostValidator {
        val isDebuggable = (applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE) != 0
        return if (isDebuggable) {
            HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
        } else {
            HostValidator.Builder(applicationContext)
                    .addAllowedHosts(R.array.hosts_allowlist_sample)
                    .build()
        }
    }

    companion object {
        const val LOG_TAG: String = "MapeakCarAppService"
    }
}
