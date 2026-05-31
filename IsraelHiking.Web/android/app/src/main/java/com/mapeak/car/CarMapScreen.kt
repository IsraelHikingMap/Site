package com.mapeak.car

import android.location.Location
import androidx.annotation.DrawableRes
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
import java.util.TimeZone
import org.json.JSONException

class CarMapScreen(private val carContext: CarContext, private val carMapRenderer: CarMapRenderer) :
        Screen(carContext), CapacitorStore.Listener, DefaultLifecycleObserver {

    private val store: CapacitorStore = CapacitorStore.get(carContext)
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
            CarStoreKeys.LOCATION -> recomputeStatistics()
            CarStoreKeys.ROUTE -> {
                loadRoutes()
                recomputeStatistics()
            }
            CarStoreKeys.CONFIG -> {
                loadUnits()
                invalidate()
            }
        }
    }

    private fun recomputeStatistics() {
        val location: Location? = store.getTransient(CarStoreKeys.LOCATION)
        val next = if (location == null) null else CarStatisticsCalculator.compute(routes, location)
        if (next != statistics) {
            statistics = next
            invalidate()
        }
    }

    private fun loadRoutes() {
        routes =
                try {
                    CarRouteData.listFromJson(store.load(CarStoreKeys.ROUTE))
                } catch (_: JSONException) {
                    emptyList()
                }
    }

    private fun loadUnits() {
        units = store.load(CarStoreKeys.CONFIG)?.optString("units") ?: DEFAULT_UNITS
    }

    override fun onGetTemplate(): Template {
        val templateBuilder = NavigationTemplate.Builder().setActionStrip(buildActionStrip())
        if (carContext.carAppApiLevel >= 2) {
            templateBuilder.setMapActionStrip(buildMapActionStrip())
        }
        buildTravelEstimate()?.let { templateBuilder.setDestinationTravelEstimate(it) }
        return templateBuilder.build()
    }

    private fun buildTravelEstimate(): TravelEstimate? {
        val stats = statistics ?: return null
        val remainingDistance =
                if (units == UNIT_IMPERIAL) {
                    Distance.create(stats.remainingMeters / METERS_PER_MILE, Distance.UNIT_MILES)
                } else {
                    Distance.create(
                            stats.remainingMeters / METERS_PER_KILOMETER,
                            Distance.UNIT_KILOMETERS
                    )
                }
        val arrivalTime =
                DateTimeWithZone.create(
                        System.currentTimeMillis() + stats.remainingSeconds * 1000,
                        TimeZone.getDefault()
                )
        return TravelEstimate.Builder(remainingDistance, arrivalTime)
                .setRemainingTimeSeconds(stats.remainingSeconds)
                .build()
    }

    private fun buildActionStrip(): ActionStrip =
            ActionStrip.Builder().addAction(iconAction(R.drawable.ic_menu, false)).build()

    private fun buildMapActionStrip(): ActionStrip =
            ActionStrip.Builder()
                    .addAction(Action.PAN)
                    .addAction(
                            iconAction(R.drawable.ic_zoom_in) { carMapRenderer.zoomInFromButton() }
                    )
                    .addAction(
                            iconAction(R.drawable.ic_zoom_out) {
                                carMapRenderer.zoomOutFromButton()
                            }
                    )
                    .addAction(
                            iconAction(R.drawable.ic_recenter) {
                                carMapRenderer.recenterFromButton()
                            }
                    )
                    .build()

    private fun iconAction(
            @DrawableRes iconRes: Int,
            persist: Boolean = true,
            onClick: (() -> Unit)? = null,
    ): Action {
        val builder =
                Action.Builder()
                        .setIcon(
                                CarIcon.Builder(IconCompat.createWithResource(carContext, iconRes))
                                        .build()
                        )
        if (persist && carContext.carAppApiLevel >= PERSISTENT_ACTION_MIN_API) {
            builder.setFlags(Action.FLAG_IS_PERSISTENT)
        }
        if (onClick != null) {
            builder.setOnClickListener { onClick() }
        }
        return builder.build()
    }

    companion object {
        private const val DEFAULT_UNITS = "metric"
        private const val UNIT_IMPERIAL = "imperial"
        private const val METERS_PER_KILOMETER = 1000.0
        private const val METERS_PER_MILE = 1609.344
        private const val PERSISTENT_ACTION_MIN_API = 5
    }
}
