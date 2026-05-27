package com.mapeak.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.car.app.navigation.model.TravelEstimate
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.mapeak.R
import com.mapeak.car.CarMessageBus.CarEvent
import com.mapeak.car.CarMessageBus.CarEventListener
import java.util.TimeZone

class CarMapScreen(private val carContext: CarContext, private val carMapRenderer: CarMapRenderer) :
    Screen(
        carContext
    ), CarEventListener, DefaultLifecycleObserver {
    private var remainingMeters: Double? = null
    private var remainingSeconds: Long? = null
    private var units = "metric"

    init {
        lifecycle.addObserver(this)
    }

    override fun onCreate(owner: LifecycleOwner) {
        CarMessageBus.instance.registerListener(this)
    }

    override fun onDestroy(owner: LifecycleOwner) {
        CarMessageBus.instance.unregisterListener(this)
    }

    override fun onCarEvent(event: CarEvent) {
        if (CarMessageBus.EVENT_STATISTICS != event.actionId) {
            return
        }
        val payload = event.payload
        if (payload == null) {
            remainingMeters = null
            remainingSeconds = null
        } else {
            remainingMeters = payload.optDouble("remainingMeters")
            remainingSeconds = payload.optLong("remainingSeconds")
            units = payload.optString("units", "metric")
        }
        invalidate()
    }

    override fun onGetTemplate(): Template {
        val templateBuilder = NavigationTemplate.Builder()
        templateBuilder.setActionStrip(buildActionStrip().build())
        if (carContext.getCarAppApiLevel() >= 2) {
            templateBuilder.setMapActionStrip(buildMapActionStrip(carMapRenderer).build())
        }
        val estimate = buildTravelEstimate()
        if (estimate != null) {
            templateBuilder.setDestinationTravelEstimate(estimate)
        }
        return templateBuilder.build()
    }

    private fun buildTravelEstimate(): TravelEstimate? {
        if (remainingMeters == null || remainingSeconds == null) {
            return null
        }
        val isImperial = "imperial" == units
        val remainingDistance = if (isImperial)
            Distance.create(remainingMeters!! / 1609.344, Distance.UNIT_MILES)
        else
            Distance.create(remainingMeters!! / 1000.0, Distance.UNIT_KILOMETERS)
        val arrivalTime = DateTimeWithZone.create(
            System.currentTimeMillis() + remainingSeconds!! * 1000,
            TimeZone.getDefault()
        )
        return TravelEstimate.Builder(remainingDistance, arrivalTime)
            .setRemainingTimeSeconds(remainingSeconds!!)
            .build()
    }

    private fun buildActionStrip(): ActionStrip.Builder {
        val actionStripBuilder = ActionStrip.Builder()

        actionStripBuilder.addAction(
            Action.Builder()
                .setIcon(
                    CarIcon.Builder(
                        IconCompat.createWithResource(
                            carContext,
                            R.drawable.ic_menu
                        )
                    )
                        .build()
                )
                .build()
        )

        return actionStripBuilder
    }

    private fun buildMapActionStrip(carMapRenderer: CarMapRenderer): ActionStrip.Builder {
        val actionStripBuilder = ActionStrip.Builder()

        actionStripBuilder.addAction(Action.PAN)

        actionStripBuilder.addAction(
            Action.Builder()
                .setIcon(
                    CarIcon.Builder(
                        IconCompat.createWithResource(
                            carContext,
                            R.drawable.ic_zoom_in
                        )
                    )
                        .build()
                )
                .setOnClickListener { carMapRenderer.zoomInFromButton() }
                .build()
        )

        actionStripBuilder.addAction(
            Action.Builder()
                .setIcon(
                    CarIcon.Builder(
                        IconCompat.createWithResource(
                            carContext,
                            R.drawable.ic_zoom_out
                        )
                    )
                        .build()
                )
                .setOnClickListener { carMapRenderer.zoomOutFromButton() }
                .build()
        )

        actionStripBuilder.addAction(
            Action.Builder()
                .setIcon(
                    CarIcon.Builder(
                        IconCompat.createWithResource(
                            carContext,
                            R.drawable.ic_recenter
                        )
                    )
                        .build()
                )
                .setOnClickListener { carMapRenderer.recenterFromButton() }
                .build()
        )

        return actionStripBuilder
    }
}
