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
import org.json.JSONException
import java.util.TimeZone

class CarMapScreen(private val carContext: CarContext, private val carMapRenderer: CarMapRenderer) :
    Screen(
        carContext
    ), CarStore.Listener, DefaultLifecycleObserver {
    private val store: CarStore = CarStore.get(carContext)
    private var routes: List<CarRouteData> = emptyList()
    private var statistics: CarStatistics? = null
    private var units: String = DEFAULT_UNITS

    init {
        lifecycle.addObserver(this)
    }

    override fun onCreate(owner: LifecycleOwner) {
        store.addListener(this)
        loadRoutes()
        loadUnits()
    }

    override fun onDestroy(owner: LifecycleOwner) {
        store.removeListener(this)
    }

    override fun onCarStoreUpdated(key: String) {
        when (key) {
            CarStore.KEY_LOCATION -> recomputeStatistics()
            CarStore.KEY_ROUTE -> {
                loadRoutes()
                recomputeStatistics()
            }
            CarStore.KEY_CONFIG -> {
                loadUnits()
                invalidate()
            }
        }
    }

    private fun recomputeStatistics() {
        val location = store.getLocation()
        val next = if (location == null) null else CarStatisticsCalculator.compute(routes, location)
        if (next != statistics) {
            statistics = next
            invalidate()
        }
    }

    private fun loadRoutes() {
        routes = try {
            CarRouteData.listFromJson(store.loadRoutes())
        } catch (_: JSONException) {
            emptyList()
        }
    }

    private fun loadUnits() {
        units = store.loadConfig()?.optString("units", DEFAULT_UNITS) ?: DEFAULT_UNITS
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
        val stats = statistics ?: return null
        val remainingDistance = if (units == "imperial") {
            Distance.create(stats.remainingMeters / 1609.344, Distance.UNIT_MILES)
        } else {
            Distance.create(stats.remainingMeters / 1000.0, Distance.UNIT_KILOMETERS)
        }
        val arrivalTime = DateTimeWithZone.create(
            System.currentTimeMillis() + stats.remainingSeconds * 1000,
            TimeZone.getDefault()
        )
        return TravelEstimate.Builder(remainingDistance, arrivalTime)
            .setRemainingTimeSeconds(stats.remainingSeconds)
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

    companion object {
        private const val DEFAULT_UNITS = "metric"
    }
}
