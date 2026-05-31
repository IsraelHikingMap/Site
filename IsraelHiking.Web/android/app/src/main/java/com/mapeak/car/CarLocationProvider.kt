package com.mapeak.car

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

class CarLocationProvider(context: Context) {
    private val appContext: Context = context.applicationContext
    private val fusedClient: FusedLocationProviderClient =
            LocationServices.getFusedLocationProviderClient(appContext)
    private val store: CapacitorStore = CapacitorStore.get(appContext)
    private var started = false

    private val locationCallback =
            object : LocationCallback() {
                override fun onLocationResult(result: LocationResult) {
                    result.lastLocation?.let { publishLocation(it) }
                }
            }

    /**
     * Broadcast the latest fix to listeners and persist its coordinates so the map can re-center on
     * the last known position after a cold start, before a fresh fix arrives.
     */
    private fun publishLocation(location: Location) {
        store.setTransient(CarStoreKeys.LOCATION, location)
        store.saveFloat(CarStoreKeys.LAST_LAT, location.latitude.toFloat())
        store.saveFloat(CarStoreKeys.LAST_LNG, location.longitude.toFloat())
    }

    @Synchronized
    fun start() {
        if (started) {
            return
        }
        if (!hasLocationPermission()) {
            Log.w(LOG_TAG, "Location permission not granted, skipping start")
            return
        }
        val request =
                LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, INTERVAL_MS)
                        .setMinUpdateDistanceMeters(MIN_DISTANCE_M)
                        .build()
        try {
            fusedClient.requestLocationUpdates(request, locationCallback, Looper.getMainLooper())
            fusedClient.lastLocation.addOnSuccessListener { last: Location? ->
                last?.let { publishLocation(it) }
            }
            started = true
            Log.i(LOG_TAG, "Started fused location updates")
        } catch (e: SecurityException) {
            Log.e(LOG_TAG, "SecurityException requesting location updates", e)
        }
    }

    @Synchronized
    fun stop() {
        if (!started) {
            return
        }
        fusedClient.removeLocationUpdates(locationCallback)
        started = false
        Log.i(LOG_TAG, "Stopped location updates")
    }

    private fun hasLocationPermission(): Boolean {
        val fine =
                ContextCompat.checkSelfPermission(
                        appContext,
                        Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
        val coarse =
                ContextCompat.checkSelfPermission(
                        appContext,
                        Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
        return fine || coarse
    }

    companion object {
        const val LOG_TAG: String = "CarLocationProvider"
        private const val INTERVAL_MS = 1000L
        private const val MIN_DISTANCE_M = 5f
    }
}
