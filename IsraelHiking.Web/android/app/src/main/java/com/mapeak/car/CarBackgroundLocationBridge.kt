package com.mapeak.car

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.util.Log
import androidx.core.content.IntentCompat
import androidx.localbroadcastmanager.content.LocalBroadcastManager
import com.getcapacitor.JSObject
import com.mapeak.car.CarMessageBus.CarEvent
import com.mapeak.car.CarMessageBus.CarEventListener

class CarBackgroundLocationBridge(context: Context) : CarEventListener {
    private val appContext: Context = context.applicationContext
    private val localBroadcastManager: LocalBroadcastManager = LocalBroadcastManager.getInstance(appContext)
    private var isRegistered = false

    private val locationReceiver: BroadcastReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent) {
            val location = IntentCompat.getParcelableExtra(intent, "location", Location::class.java) ?: return
            emitLocation(location)
            emitCenter(location)
        }
    }

    init {
        CarMessageBus.instance.registerListener(this)
    }

    fun destroy() {
        stop()
        CarMessageBus.instance.unregisterListener(this)
    }

    override fun onCarEvent(event: CarEvent) {
        if (CarMessageBus.EVENT_BACKGROUND_MODE != event.actionId) {
            return
        }
        val active = event.payload != null && event.payload.optBoolean("background", false)
        if (active) {
            start()
        } else {
            stop()
        }
    }

    @Synchronized
    private fun start() {
        if (isRegistered) {
            return
        }
        localBroadcastManager.registerReceiver(
            locationReceiver, IntentFilter(
                CAPGO_LOCATION_BROADCAST
            )
        )
        isRegistered = true
        Log.i(LOG_TAG, "Background GPS bridge started")
    }

    @Synchronized
    private fun stop() {
        if (!isRegistered) {
            return
        }
        try {
            localBroadcastManager.unregisterReceiver(locationReceiver)
        } catch (_: IllegalArgumentException) {
        }
        isRegistered = false
        Log.i(LOG_TAG, "Background GPS bridge stopped")
    }

    private fun emitLocation(location: Location) {
        val payload = JSObject()
        if (location.hasBearing()) {
            payload.put("bearing", location.bearing.toDouble())
        }
        payload.put("lat", location.latitude)
        payload.put("lng", location.longitude)
        payload.put("acc", location.accuracy.toDouble())
        CarMessageBus.instance.emitEvent(CarEvent(CarMessageBus.EVENT_LOCATION, payload))
    }

    private fun emitCenter(location: Location) {
        val payload = JSObject()
        payload.put("lat", location.latitude)
        payload.put("lng", location.longitude)
        payload.put(
            "bearing",
            (if (location.hasBearing()) location.bearing else 0f).toDouble()
        )
        payload.put("offsetY", 100)
        CarMessageBus.instance.emitEvent(CarEvent(CarMessageBus.EVENT_CENTER, payload))
    }

    companion object {
        const val LOG_TAG: String = "CarBgLocationBridge"

        private const val CAPGO_LOCATION_BROADCAST =
            "com.capgo.capacitor_background_geolocation.broadcast"
    }
}
