package com.mapeak.car

import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.util.Log
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.ScreenManager
import androidx.car.app.Session
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

class CarSession : Session() {
    private var renderer: CarMapRenderer? = null

    override fun onCreateScreen(intent: Intent): Screen {
        Log.v(LOG_TAG, "onCreateScreen: $intent")
        val renderer = CarMapRenderer(carContext, lifecycle)
        this.renderer = renderer
        val provider = CarLocationProvider(carContext)
        lifecycle.addObserver(
                object : DefaultLifecycleObserver {
                    override fun onStart(owner: LifecycleOwner) {
                        provider.start()
                    }

                    override fun onStop(owner: LifecycleOwner) {
                        provider.stop()
                    }
                }
        )

        val pendingQuery = if (isNavigationIntent(intent)) navigationQuery(intent) else null
        val mapScreen = CarMapScreen(carContext, renderer, pendingQuery)
        carContext.getCarService(ScreenManager::class.java).push(mapScreen)
        return mapScreen
    }

    override fun onNewIntent(intent: Intent) {
        Log.v(LOG_TAG, "onNewIntent: $intent")
        if (isNavigationIntent(intent)) {
            val screenManager = carContext.getCarService(ScreenManager::class.java)
            screenManager.popToRoot()
            screenManager.push(CarSearchScreen(carContext, navigationQuery(intent)))
        }
    }

    override fun onCarConfigurationChanged(newConfiguration: Configuration) {
        Log.v(LOG_TAG, "onCarConfigurationChanged, isDarkMode=${carContext.isDarkMode}")
        renderer?.setNightMode(carContext.isDarkMode)
    }

    private fun isNavigationIntent(intent: Intent): Boolean =
            CarContext.ACTION_NAVIGATE == intent.action

    /**
     * Extracts a search term from a car navigation intent. The data is a geo URI such as
     * "geo:0,0?q=Tel+Aviv" or "geo:32.1,34.8". Returns the "q" query when present, otherwise the
     * raw "lat,lng" so the search/coordinate parsing can resolve it.
     *
     * geo: URIs are opaque (the scheme-specific part doesn't start with "/"), so [Uri.getQuery] is
     * always null — we parse the (encoded) scheme-specific part ourselves.
     */
    private fun navigationQuery(intent: Intent): String? {
        val uri: Uri = intent.data ?: return null
        val schemeSpecificPart = uri.encodedSchemeSpecificPart ?: return null
        if (schemeSpecificPart.contains("q=")) {
            val rawQuery = schemeSpecificPart.substringAfter("q=").substringBefore("&")
            // In query strings '+' encodes a space; Uri.decode only handles percent-escapes.
            val decoded = Uri.decode(rawQuery.replace("+", " ")).substringBefore("(").trim()
            if (decoded.isNotBlank()) {
                return decoded
            }
        }
        // No "q=" param: fall back to the coordinates (e.g. geo:lat,lng).
        return schemeSpecificPart.substringBefore("?").takeIf { it.isNotBlank() }
    }

    companion object {
        const val LOG_TAG: String = "MyCarSession"
    }
}
