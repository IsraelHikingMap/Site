package com.mapeak.car

import android.content.Context
import android.location.Location
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import org.json.JSONException

/**
 * Single source of truth for car-side state. Combines persistent values
 * (style/route in SharedPreferences) and transient values (location/connected
 * in memory) behind one listener API: subscribers receive a key whenever any
 * value updates, then read the current value back from the store. Mirrors the
 * NGXS-style "state + select" pattern used on the JS side.
 */
class CarStore private constructor(context: Context) {
    private val prefs = context.applicationContext
        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val listeners: MutableList<Listener> = ArrayList()

    @Volatile
    private var locationCache: Location? = null

    @Volatile
    private var connectedCache: Boolean = false

    fun interface Listener {
        fun onCarStoreUpdated(key: String)
    }

    @Synchronized
    fun addListener(listener: Listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
        }
    }

    @Synchronized
    fun removeListener(listener: Listener) {
        listeners.remove(listener)
    }

    fun saveStyle(style: JSObject) {
        prefs.edit().putString(KEY_STYLE, style.toString()).apply()
        notifyChanged(KEY_STYLE)
    }

    fun loadStyle(): String? = prefs.getString(KEY_STYLE, null)

    fun saveRoutes(payload: JSObject) {
        prefs.edit().putString(KEY_ROUTE, payload.toString()).apply()
        notifyChanged(KEY_ROUTE)
    }

    fun clearRoutes() {
        prefs.edit().remove(KEY_ROUTE).apply()
        notifyChanged(KEY_ROUTE)
    }

    fun loadRoutes(): JSObject? {
        val raw = prefs.getString(KEY_ROUTE, null) ?: return null
        return try {
            JSObject(raw)
        } catch (_: JSONException) {
            null
        }
    }

    fun saveConfig(config: JSObject) {
        prefs.edit().putString(KEY_CONFIG, config.toString()).apply()
        notifyChanged(KEY_CONFIG)
    }

    fun loadConfig(): JSObject? {
        val raw = prefs.getString(KEY_CONFIG, null) ?: return null
        return try {
            JSObject(raw)
        } catch (_: JSONException) {
            null
        }
    }

    /** Camera zoom is persisted but not part of the listener contract. */
    fun saveZoom(zoom: Double) {
        prefs.edit().putFloat(KEY_ZOOM, zoom.toFloat()).apply()
    }

    fun loadZoom(): Double? {
        if (!prefs.contains(KEY_ZOOM)) return null
        return prefs.getFloat(KEY_ZOOM, 14f).toDouble()
    }

    fun setLocation(location: Location?) {
        locationCache = location
        notifyChanged(KEY_LOCATION)
    }

    fun getLocation(): Location? = locationCache

    fun setConnected(connected: Boolean) {
        if (connectedCache == connected) {
            return
        }
        connectedCache = connected
        notifyChanged(KEY_CONNECTED)
    }

    fun isConnected(): Boolean = connectedCache

    private fun notifyChanged(key: String) {
        mainHandler.post {
            val snapshot: List<Listener>
            synchronized(this) {
                snapshot = ArrayList(listeners)
            }
            for (listener in snapshot) {
                listener.onCarStoreUpdated(key)
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "mapeak_car"
        private const val KEY_ZOOM = "zoom"
        const val KEY_STYLE = "style"
        const val KEY_ROUTE = "route"
        const val KEY_CONFIG = "config"
        const val KEY_LOCATION = "location"
        const val KEY_CONNECTED = "connected"

        @Volatile
        private var instance: CarStore? = null

        @JvmStatic
        fun get(context: Context): CarStore {
            return instance ?: synchronized(CarStore::class.java) {
                instance ?: CarStore(context).also { instance = it }
            }
        }
    }
}
