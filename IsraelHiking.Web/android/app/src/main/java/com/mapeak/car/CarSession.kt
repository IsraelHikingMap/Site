package com.mapeak.car

import android.content.Intent
import android.util.Log
import androidx.car.app.Screen
import androidx.car.app.ScreenManager
import androidx.car.app.Session
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

class CarSession : Session() {
    private var carMapRenderer: CarMapRenderer? = null
    private var locationProvider: CarLocationProvider? = null

    override fun onCreateScreen(intent: Intent): Screen {
        Log.v(LOG_TAG, "onCreateScreen: $intent")
        carMapRenderer = CarMapRenderer(carContext, lifecycle)

        val provider = CarLocationProvider(carContext)
        locationProvider = provider
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onStart(owner: LifecycleOwner) {
                provider.start()
            }

            override fun onStop(owner: LifecycleOwner) {
                provider.stop()
            }
        })

        val carMapScreen = CarMapScreen(carContext, carMapRenderer!!)
        carContext.getCarService(ScreenManager::class.java).push(carMapScreen)
        return carMapScreen
    }

    companion object {
        const val LOG_TAG: String = "MyCarSession"
    }
}
