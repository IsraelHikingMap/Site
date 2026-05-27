package com.mapeak.car

import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSObject

class CarMessageBus private constructor() {
    private val mainHandler = Handler(Looper.getMainLooper())

    @JvmRecord
    data class CarEvent(@JvmField val actionId: String, @JvmField val payload: JSObject?)

    interface CarEventListener {
        fun onCarEvent(event: CarEvent)
    }

    private val listeners: MutableList<CarEventListener> = ArrayList<CarEventListener>()
    private val lastEvents: MutableMap<String?, CarEvent> = HashMap<String?, CarEvent>()

    @Synchronized
    fun registerListener(listener: CarEventListener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener)
            // Replay the last event per actionId so late listeners don't miss state
            for (event in lastEvents.values) {
                synchronized(this@CarMessageBus) {
                    mainHandler.post { listener.onCarEvent(event) }
                }
            }
        }
    }

    @Synchronized
    fun unregisterListener(listener: CarEventListener?) {
        listeners.remove(listener)
    }

    @Synchronized
    fun emitEvent(event: CarEvent) {
        lastEvents[event.actionId] = event
        mainHandler.post {
            synchronized(this@CarMessageBus) {
                for (listener in listeners) {
                    listener.onCarEvent(event)
                }
            }
        }
    }

    companion object {
        const val EVENT_MOVEEND: String = "moveend"
        const val EVENT_CENTER: String = "center"
        const val EVENT_LOCATION: String = "location"
        const val EVENT_ROUTE: String = "route"
        const val EVENT_STYLE: String = "style"
        const val EVENT_CONNECTED: String = "connected"
        const val EVENT_STATISTICS: String = "statistics"
        const val EVENT_BACKGROUND_MODE: String = "background-mode"

        @JvmStatic
        val instance: CarMessageBus by lazy { CarMessageBus() }
    }
}
