package com.mapeak.car

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import org.json.JSONArray

@CapacitorPlugin(name = "Car")
class CarPlugin : Plugin() {
    private lateinit var store: CarStore

    override fun load() {
        store = CarStore.get(context)
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

        when (key) {
            CarStore.KEY_STYLE -> {
                addLayeringAnchorTo(value)
                store.saveStyle(value)
            }
            CarStore.KEY_ROUTE -> {
                if (value.optJSONArray("routes")?.length() == 0) {
                    store.clearRoutes()
                } else {
                    store.saveRoutes(value)
                }
            }
            CarStore.KEY_CONFIG -> store.saveConfig(value)
            else -> {
                call.reject("unknown key: $key")
                return
            }
        }
        call.resolve()
    }

    private fun addLayeringAnchorTo(style: JSObject) {
        val sources = style.optJSONObject("sources") ?: JSObject().also { style.put("sources", it) }
        val anchorData = JSObject()
            .put("type", "FeatureCollection")
            .put("features", JSONArray())
        val anchorSource = JSObject()
            .put("type", "geojson")
            .put("data", anchorData)
        sources.put(CarMapContainer.LAYERING_ANCHOR_SOURCE_ID, anchorSource)

        val layers = style.optJSONArray("layers") ?: JSONArray().also { style.put("layers", it) }
        val anchorLayer = JSObject()
            .put("id", CarMapContainer.LAYERING_ANCHOR_ID)
            .put("type", "circle")
            .put("source", CarMapContainer.LAYERING_ANCHOR_SOURCE_ID)
            .put("layout", JSObject().put("visibility", "none"))
        layers.put(anchorLayer)
    }
}
