package com.mapeak.car

import android.content.Intent
import android.util.Log
import androidx.car.app.Screen
import androidx.car.app.ScreenManager
import androidx.car.app.Session
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner

class CarSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen {
        Log.v(LOG_TAG, "onCreateScreen: $intent")
        val renderer = CarMapRenderer(carContext, lifecycle)
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

        val screen = CarMapScreen(carContext, renderer)
        carContext.getCarService(ScreenManager::class.java).push(screen)
        return screen
    }

    companion object {
        const val LOG_TAG: String = "MyCarSession"
    }
}
