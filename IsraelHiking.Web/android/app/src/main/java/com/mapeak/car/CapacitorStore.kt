package com.mapeak.car

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject
import java.util.concurrent.ConcurrentHashMap
import org.json.JSONException

/**
 * Generic reactive key-value store for that. Holds persistent values (in SharedPreferences) and
 * transient in-memory values behind one listener API: subscribers receive a key whenever a value
 * changes, then read the current value back from the store. The store knows nothing about what the
 * keys mean.
 */
class CapacitorStore private constructor(context: Context) {
    private val prefs =
            context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val mainHandler = Handler(Looper.getMainLooper())
    private val listeners: MutableList<Listener> = ArrayList()
    private val transientValues = ConcurrentHashMap<String, Any>()

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

    /** Persist a JSON value and notify listeners. */
    fun save(key: String, value: JSObject) {
        prefs.edit().putString(key, value.toString()).apply()
        notifyChanged(key)
    }

    /** Remove a persisted value and notify listeners. */
    fun remove(key: String) {
        prefs.edit().remove(key).apply()
        notifyChanged(key)
    }

    fun load(key: String): JSObject? {
        val raw = prefs.getString(key, null) ?: return null
        return try {
            JSObject(raw)
        } catch (_: JSONException) {
            null
        }
    }

    fun loadString(key: String): String? = prefs.getString(key, null)

    /** Persist a primitive value. Not part of the listener contract. */
    fun saveFloat(key: String, value: Float) {
        prefs.edit().putFloat(key, value).apply()
    }

    fun loadFloat(key: String, default: Float): Float = prefs.getFloat(key, default)

    /**
     * Set a transient (in-memory) value and notify listeners when it changes. Passing null clears
     * the value. Equality suppresses no-op updates, so callers can publish unconditionally.
     */
    fun setTransient(key: String, value: Any?) {
        val previous =
                if (value == null) transientValues.remove(key) else transientValues.put(key, value)
        if (previous != value) {
            notifyChanged(key)
        }
    }

    @Suppress("UNCHECKED_CAST") fun <T> getTransient(key: String): T? = transientValues[key] as T?

    private fun notifyChanged(key: String) {
        mainHandler.post {
            val snapshot: List<Listener>
            synchronized(CapacitorStore) { snapshot = ArrayList(listeners) }
            for (listener in snapshot) {
                listener.onCarStoreUpdated(key)
            }
        }
    }

    companion object {
        private const val PREFS_NAME = "capacitor_store"

        @Volatile private var instance: CapacitorStore? = null

        @JvmStatic
        fun get(context: Context): CapacitorStore {
            return instance
                    ?: synchronized(CapacitorStore::class.java) {
                        instance ?: CapacitorStore(context).also { instance = it }
                    }
        }
    }
}
