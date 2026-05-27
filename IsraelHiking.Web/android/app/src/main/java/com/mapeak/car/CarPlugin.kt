package com.mapeak.car

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.mapeak.car.CarMessageBus.CarEvent
import com.mapeak.car.CarMessageBus.CarEventListener
import com.mapeak.car.CarMessageBus.Companion.instance

@CapacitorPlugin(name = "Car")
class CarPlugin : Plugin(), CarEventListener {
    private var isConnected = false
    private var backgroundLocationBridge: CarBackgroundLocationBridge? = null

    override fun load() {
        instance.registerListener(this)
        backgroundLocationBridge = CarBackgroundLocationBridge(context)
    }

    protected override fun handleOnDestroy() {
        if (backgroundLocationBridge != null) {
            backgroundLocationBridge!!.destroy()
            backgroundLocationBridge = null
        }
        instance.unregisterListener(this)
        super.handleOnDestroy()
    }

    @Suppress("unused")
    @PluginMethod
    fun sendMessage(call: PluginCall) {
        val type = call.getString("type")
        if (type == null || type.trim { it <= ' ' }.isEmpty()) {
            call.reject("type is required")
            return
        }

        val payload = call.getObject("payload")
        instance.emitEvent(CarEvent(type, payload))
        call.resolve()
    }

    @Suppress("unused")
    @PluginMethod
    fun getConnectionState(call: PluginCall) {
        val payload = JSObject()
        payload.put("connected", isConnected)
        call.resolve(payload)
    }

    override fun onCarEvent(event: CarEvent) {
        when (event.actionId) {
            CarMessageBus.EVENT_CONNECTED -> {
                isConnected = event.payload!!.getBool("connected")!!
                raiseEvent(event.actionId, event.payload)
            }

            CarMessageBus.EVENT_MOVEEND -> raiseEvent(event.actionId, event.payload)
        }
    }

    private fun raiseEvent(actionId: String?, payload: JSObject?) {
        if (getBridge() != null) {
            getBridge().executeOnMainThread {
                notifyListeners(actionId, payload)
            }
        }
    }
}
