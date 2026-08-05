package com.mapeak.car

import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "ReactivePreferences")
class ReactivePreferencesPlugin : Plugin(), CapacitorStore.Listener {
    private lateinit var store: CapacitorStore

    override fun load() {
        store = CapacitorStore.get(context)
        store.addListener(this)
    }

    @Suppress("unused")
    @PluginMethod
    fun storeValue(call: PluginCall) {
        val key = call.getString("key")
        if (key.isNullOrBlank()) {
            call.reject("key is required")
            return
        }
        val value = call.getObject("value")
        if (value == null) {
            call.reject("value is required for key=$key")
            return
        }

        store.save(key, value)
        call.resolve()
    }

    override fun onCarStoreUpdated(key: String) {
        notifyListeners(key, store.load(key))
    }
}
