package com.mapeak.car

/**
 * Well-known keys exchanged through [CarStore]. STYLE/ROUTE/CONFIG mirror the string keys sent from
 * the web layer via the Car Capacitor plugin and must not change. LOCATION/CONNECTED are produced
 * on the native side and broadcast to listeners. ZOOM/LAST_LAT/LAST_LNG are persisted-only and are
 * never part of the listener contract.
 */
object CarStoreKeys {
    const val STYLE = "style"
    const val ROUTE = "route"
    const val CONFIG = "config"
    const val LOCATION = "location"
    const val ZOOM = "zoom"
    const val LAST_LAT = "last_lat"
    const val LAST_LNG = "last_lng"
}
