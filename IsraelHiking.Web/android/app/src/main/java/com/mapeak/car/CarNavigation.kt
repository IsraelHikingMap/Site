package com.mapeak.car

import android.location.Location
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.car.app.CarContext
import androidx.car.app.model.CarColor
import androidx.car.app.model.CarIcon
import androidx.car.app.model.DateTimeWithZone
import androidx.car.app.model.Distance
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.NavigationManagerCallback
import androidx.car.app.navigation.model.Destination
import androidx.car.app.navigation.model.Maneuver
import androidx.car.app.navigation.model.NavigationTemplate.NavigationInfo
import androidx.car.app.navigation.model.RoutingInfo
import androidx.car.app.navigation.model.Step
import androidx.car.app.navigation.model.TravelEstimate
import androidx.car.app.navigation.model.Trip
import androidx.core.graphics.drawable.IconCompat
import com.getcapacitor.JSObject
import com.mapeak.R
import java.util.TimeZone
import kotlin.math.roundToInt
import org.json.JSONArray
import org.json.JSONException
import org.maplibre.android.geometry.LatLng
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfMeasurement

/**
 * Drives the Android for Cars navigation contract for the active route:
 * - feeds next-turn information to the vehicle cluster via [NavigationManager.updateTrip] (NF-4),
 * - exposes [navigationInfo] (a [RoutingInfo]) for the on-screen [NavigationTemplate] (NF-2),
 * - implements the "test drive" simulation triggered by
 * [NavigationManagerCallback.onAutoDriveEnabled] (NF-7).
 *
 * Whenever the route changes we ask the map-match backend for real turn-by-turn instructions and
 * cache them (keyed to the route) under [CarStoreKeys.ROUTE_INSTRUCTIONS] so navigation keeps the
 * directions offline. Until/unless the backend answers we fall back to turns synthesized from the
 * route geometry (see [CarManeuverGenerator]). Everything reacts to the existing store keys
 * (ROUTE/LOCATION), and the simulator publishes synthetic locations through the same LOCATION key,
 * so the map, statistics and cluster all update with no extra wiring.
 */
class CarNavigation(
        private val carContext: CarContext,
        /** Stops real GPS updates while the test-drive simulation is driving the location. */
        private val pauseRealLocation: () -> Unit
) : CapacitorStore.Listener {

    private val store: CapacitorStore = CapacitorStore.get(carContext)
    private val navigationManager: NavigationManager =
            carContext.getCarService(NavigationManager::class.java)
    private val handler = Handler(Looper.getMainLooper())
    private val notification = CarNavigationNotification(carContext)
    private val backend = CarBackendService()

    private var routePoints: List<Point> = emptyList()
    private var maneuvers: List<CarManeuver> = emptyList()
    /**
     * Bumped on every route change so a late instructions fetch for an old route can be dropped.
     */
    private var routeEpoch: Int = 0
    private var totalLengthM: Double = 0.0
    private var destinationName: String? = null
    private var navigating: Boolean = false
    private var autoDrive: Boolean = false
    private var simulating: Boolean = false
    private var simDistanceM: Double = 0.0

    /** Current step/next-turn info for the navigation template; null when not navigating. */
    var navigationInfo: NavigationInfo? = null
        private set

    /** Invoked when [navigationInfo] changes so the screen can invalidate its template. */
    var onNavigationInfoChanged: (() -> Unit)? = null

    private val callback =
            object : NavigationManagerCallback {
                override fun onStopNavigation() = stopNavigation()

                override fun onAutoDriveEnabled() {
                    autoDrive = true
                    pauseRealLocation()
                    if (navigating) startSimulation()
                }
            }

    fun attach() {
        navigationManager.setNavigationManagerCallback(callback)
        store.addListener(this)
        onRouteChanged()
    }

    fun detach() {
        stopSimulation()
        endNavigation()
        notification.cancel()
        navigationManager.clearNavigationManagerCallback()
        store.removeListener(this)
    }

    override fun onCarStoreUpdated(key: String) {
        when (key) {
            CarStoreKeys.ROUTE -> onRouteChanged()
            CarStoreKeys.LOCATION -> onLocationChanged()
        }
    }

    private fun onRouteChanged() {
        val routes =
                try {
                    CarRouteData.listFromJson(store.load(CarStoreKeys.ROUTE))
                } catch (_: JSONException) {
                    emptyList()
                }
        val route = routes.firstOrNull { it.lngLats.size >= 2 }
        destinationName = route?.name
        val lngLats = route?.lngLats ?: emptyList()
        routePoints = lngLats.map { Point.fromLngLat(it.longitude, it.latitude) }
        routeEpoch++
        maneuvers = loadCachedManeuvers() ?: CarManeuverGenerator.generate(lngLats)
        totalLengthM =
                if (routePoints.size >= 2)
                        TurfMeasurement.length(routePoints, TurfConstants.UNIT_METERS)
                else 0.0

        if (routePoints.size >= 2) {
            if (!navigating) {
                navigationManager.navigationStarted()
                navigating = true
            }
            if (autoDrive) startSimulation()
            fetchInstructions(lngLats, routeEpoch)
        } else {
            stopNavigation()
        }
    }

    /**
     * Ask the backend to map-match the route to the network and replace [maneuvers] with the real
     * turn-by-turn instructions, caching them so they are available offline. On failure (e.g.
     * offline) the locally-synthesized turns already in place are kept. A response that arrives
     * after the route has changed ([epoch] no longer current) is dropped.
     */
    private fun fetchInstructions(lngLats: List<LatLng>, epoch: Int) {
        backend.mapMatch(lngLats, DEFAULT_ROUTING_TYPE, language()) { fetched ->
            if (epoch != routeEpoch || fetched.isEmpty()) return@mapMatch
            maneuvers = fetched
            cacheManeuvers(fetched)
            onLocationChanged()
        }
    }

    private fun cacheManeuvers(maneuvers: List<CarManeuver>) {
        val array = JSONArray()
        maneuvers.forEach { array.put(it.toJson()) }
        val json = JSObject()
        json.put("maneuvers", array)
        store.save(CarStoreKeys.ROUTE_INSTRUCTIONS, json)
    }

    private fun loadCachedManeuvers(): List<CarManeuver>? {
        val json = store.load(CarStoreKeys.ROUTE_INSTRUCTIONS) ?: return null
        val array = json.optJSONArray("maneuvers") ?: return null
        if (array.length() == 0) return null
        return try {
            List(array.length()) { i -> CarManeuver.fromJson(array.getJSONObject(i)) }
        } catch (_: JSONException) {
            null
        }
    }

    private fun stopNavigation() {
        stopSimulation()
        endNavigation()
        notification.cancel()
        navigationInfo = null
        onNavigationInfoChanged?.invoke()
    }

    private fun endNavigation() {
        if (navigating) {
            navigationManager.navigationEnded()
            navigating = false
        }
    }

    private fun onLocationChanged() {
        if (!navigating || routePoints.size < 2 || maneuvers.isEmpty()) return
        val location: Location = store.getTransient(CarStoreKeys.LOCATION) ?: return

        val traveled = CarRouteCalculator.distanceAlongRoute(routePoints, location)
        val currentIndex = maneuvers.indexOfFirst { it.distanceAlongRouteM > traveled + EPSILON_M }
        val current = if (currentIndex >= 0) maneuvers[currentIndex] else maneuvers.last()
        val next = if (currentIndex >= 0) maneuvers.getOrNull(currentIndex + 1) else null
        val distanceToStep = (current.distanceAlongRouteM - traveled).coerceAtLeast(0.0)
        val speed =
                if (location.hasSpeed() && location.speed >= MIN_SPEED_MPS) location.speed else null

        val currentStep = step(current)
        val nextStep = next?.let { step(it) }
        val routing =
                RoutingInfo.Builder()
                        .setCurrentStep(currentStep, distance(distanceToStep))
                        .apply { nextStep?.let { setNextStep(it) } }
                        .build()
        navigationInfo = routing
        onNavigationInfoChanged?.invoke()

        val remaining = (totalLengthM - traveled).coerceAtLeast(0.0)
        val tripBuilder =
                Trip.Builder()
                        .addDestination(destination(), travelEstimate(remaining, speed))
                        .addStep(currentStep, travelEstimate(distanceToStep, speed))
        if (next != null && nextStep != null) {
            val distanceToNext = (next.distanceAlongRouteM - traveled).coerceAtLeast(0.0)
            tripBuilder.addStep(nextStep, travelEstimate(distanceToNext, speed))
        }
        navigationManager.updateTrip(tripBuilder.build())

        notification.show(
                translations().getString(current.cue),
                formatDistance(distanceToStep),
                maneuverIcon(current.type)
        )
    }

    private fun step(maneuver: CarManeuver): Step {
        val icon =
                CarIcon.Builder(
                                IconCompat.createWithResource(
                                        carContext,
                                        maneuverIcon(maneuver.type)
                                )
                        )
                        .setTint(CarColor.DEFAULT)
                        .build()
        val maneuverBuilder = Maneuver.Builder(maneuver.type).setIcon(icon)
        maneuver.roundaboutExitNumber?.let { maneuverBuilder.setRoundaboutExitNumber(it) }
        return Step.Builder(translations().getString(maneuver.cue))
                .setManeuver(maneuverBuilder.build())
                .build()
    }

    private fun maneuverIcon(type: Int): Int =
            when (type) {
                Maneuver.TYPE_TURN_SLIGHT_LEFT,
                Maneuver.TYPE_TURN_NORMAL_LEFT,
                Maneuver.TYPE_TURN_SHARP_LEFT -> R.drawable.ic_maneuver_turn_left
                Maneuver.TYPE_TURN_SLIGHT_RIGHT,
                Maneuver.TYPE_TURN_NORMAL_RIGHT,
                Maneuver.TYPE_TURN_SHARP_RIGHT -> R.drawable.ic_maneuver_turn_right
                Maneuver.TYPE_U_TURN_LEFT, Maneuver.TYPE_U_TURN_RIGHT ->
                        R.drawable.ic_maneuver_uturn
                Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CW,
                Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CCW -> R.drawable.ic_maneuver_roundabout
                Maneuver.TYPE_DESTINATION -> R.drawable.ic_maneuver_destination
                else -> R.drawable.ic_maneuver_straight
            }

    private fun destination(): Destination =
            Destination.Builder()
                    .setName(destinationName ?: translations().getString("Destination"))
                    .build()

    private fun travelEstimate(meters: Double, speedMps: Float?): TravelEstimate {
        val remainingDistance = distance(meters)
        val now = System.currentTimeMillis()
        return if (speedMps != null && speedMps > 0f) {
            val seconds = (meters / speedMps).toLong()
            TravelEstimate.Builder(
                            remainingDistance,
                            DateTimeWithZone.create(now + seconds * 1000, TimeZone.getDefault())
                    )
                    .setRemainingTimeSeconds(seconds)
                    .build()
        } else {
            TravelEstimate.Builder(
                            remainingDistance,
                            DateTimeWithZone.create(now, TimeZone.getDefault())
                    )
                    .setRemainingTimeSeconds(TravelEstimate.REMAINING_TIME_UNKNOWN)
                    .build()
        }
    }

    /** Human-readable distance for the notification text, respecting the configured units. */
    private fun formatDistance(meters: Double): String =
            if (units() == UNIT_IMPERIAL) {
                if (meters < METERS_PER_MILE / 4) "${(meters / METERS_PER_FOOT).roundToInt()} ft"
                else "%.1f mi".format(meters / METERS_PER_MILE)
            } else {
                if (meters < METERS_PER_KILOMETER) "${meters.roundToInt()} m"
                else "%.1f km".format(meters / METERS_PER_KILOMETER)
            }

    private fun distance(meters: Double): Distance =
            if (units() == UNIT_IMPERIAL) {
                if (meters < METERS_PER_MILE / 4)
                        Distance.create(meters / METERS_PER_FOOT, Distance.UNIT_FEET)
                else Distance.create(meters / METERS_PER_MILE, Distance.UNIT_MILES)
            } else {
                if (meters < METERS_PER_KILOMETER) Distance.create(meters, Distance.UNIT_METERS)
                else Distance.create(meters / METERS_PER_KILOMETER, Distance.UNIT_KILOMETERS)
            }

    // --- Test drive simulation (NF-7) ------------------------------------------------------------

    private val simulationTick =
            object : Runnable {
                override fun run() {
                    if (routePoints.size < 2) {
                        stopSimulation()
                        return
                    }
                    simDistanceM += SIM_SPEED_MPS * (SIM_TICK_MS / 1000.0)
                    val reachedEnd = simDistanceM >= totalLengthM
                    if (reachedEnd) simDistanceM = totalLengthM
                    publishSimulatedLocation()
                    if (reachedEnd) {
                        stopSimulation()
                    } else {
                        handler.postDelayed(this, SIM_TICK_MS)
                    }
                }
            }

    private fun startSimulation() {
        if (simulating || routePoints.size < 2) return
        simulating = true
        simDistanceM = 0.0
        handler.post(simulationTick)
    }

    private fun stopSimulation() {
        if (!simulating) return
        simulating = false
        handler.removeCallbacks(simulationTick)
    }

    private fun publishSimulatedLocation() {
        var accumulated = 0.0
        for (i in 0 until routePoints.size - 1) {
            val segment =
                    TurfMeasurement.distance(
                            routePoints[i],
                            routePoints[i + 1],
                            TurfConstants.UNIT_METERS
                    )
            if (accumulated + segment >= simDistanceM || i == routePoints.size - 2) {
                val t =
                        if (segment > 0) ((simDistanceM - accumulated) / segment).coerceIn(0.0, 1.0)
                        else 0.0
                val a = routePoints[i]
                val b = routePoints[i + 1]
                val location =
                        Location(SIM_PROVIDER).apply {
                            latitude = a.latitude() + (b.latitude() - a.latitude()) * t
                            longitude = a.longitude() + (b.longitude() - a.longitude()) * t
                            bearing = TurfMeasurement.bearing(a, b).toFloat()
                            speed = SIM_SPEED_MPS.toFloat()
                            accuracy = SIM_ACCURACY_M
                            time = System.currentTimeMillis()
                            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
                        }
                store.setTransient(CarStoreKeys.LOCATION, location)
                return
            }
            accumulated += segment
        }
    }

    private fun translations(): CarTranslations = CarTranslations.load(carContext, language())

    private fun language(): String =
            store.load(CarStoreKeys.CONFIG)?.optString("language")?.ifEmpty { DEFAULT_LANGUAGE }
                    ?: DEFAULT_LANGUAGE

    private fun units(): String =
            store.load(CarStoreKeys.CONFIG)?.optString("units")?.ifEmpty { DEFAULT_UNITS }
                    ?: DEFAULT_UNITS

    companion object {
        // The car experience computes its routes with the 4WD profile (see CarSearchScreen), so
        // map-match the active route with the same profile to get matching instructions.
        private const val DEFAULT_ROUTING_TYPE = "4WD"
        private const val EPSILON_M = 1.0
        private const val MIN_SPEED_MPS = 0.5f
        private const val METERS_PER_KILOMETER = 1000.0
        private const val METERS_PER_MILE = 1609.344
        private const val METERS_PER_FOOT = 0.3048
        private const val UNIT_IMPERIAL = "imperial"
        private const val DEFAULT_UNITS = "metric"
        private const val DEFAULT_LANGUAGE = "en-US"

        private const val SIM_PROVIDER = "car-simulation"
        private const val SIM_SPEED_MPS = 15.0 // ~54 km/h
        private const val SIM_TICK_MS = 1000L
        private const val SIM_ACCURACY_M = 5f
    }
}
