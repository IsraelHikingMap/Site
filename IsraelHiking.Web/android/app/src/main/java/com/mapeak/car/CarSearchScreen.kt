package com.mapeak.car

import android.location.Location
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.Row
import androidx.car.app.model.SearchTemplate
import androidx.car.app.model.Template
import com.getcapacitor.JSObject
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.geometry.LatLng

/**
 * In-app search for Android Auto. Lets the driver search for a destination (typed or via the
 * "navigate to X" voice intent), then computes a route from the current location to the selected
 * result and publishes it to the shared store so the map screen renders it. This is what satisfies
 * the Android for Cars navigation-intent requirement.
 */
class CarSearchScreen(carContext: CarContext, private val initialQuery: String?) :
        Screen(carContext) {

    private val store: CapacitorStore = CapacitorStore.get(carContext)
    private val backend = CarBackendService()
    private val translations: CarTranslations by lazy {
        CarTranslations.load(carContext, language())
    }

    private var results: List<CarSearchResult> = emptyList()
    private var isSearching: Boolean = false
    private var latestQuery: String = ""

    init {
        if (!initialQuery.isNullOrBlank()) {
            runSearch(initialQuery)
        }
    }

    override fun onGetTemplate(): Template {
        val builder =
                SearchTemplate.Builder(
                                object : SearchTemplate.SearchCallback {
                                    override fun onSearchTextChanged(searchText: String) {
                                        runSearch(searchText)
                                    }

                                    override fun onSearchSubmitted(searchText: String) {
                                        runSearch(searchText)
                                    }
                                }
                        )
                        .setHeaderAction(Action.BACK)
                        .setShowKeyboardByDefault(false)
        initialQuery?.let { builder.setInitialSearchText(it) }

        if (isSearching && results.isEmpty()) {
            builder.setLoading(true)
        } else {
            builder.setItemList(buildItemList())
        }
        return builder.build()
    }

    private fun buildItemList(): ItemList {
        val listBuilder = ItemList.Builder()
        if (results.isEmpty()) {
            listBuilder.setNoItemsMessage(translations.getString("No results found"))
            return listBuilder.build()
        }
        for (result in results) {
            val rowBuilder = Row.Builder().setTitle(result.title)
            if (result.subtitle.isNotEmpty()) {
                rowBuilder.addText(result.subtitle)
            }
            rowBuilder.setOnClickListener { onResultSelected(result) }
            listBuilder.addItem(rowBuilder.build())
        }
        return listBuilder.build()
    }

    private fun runSearch(query: String) {
        val term = query.trim()
        latestQuery = term
        if (term.length <= 2) {
            isSearching = false
            results = emptyList()
            invalidate()
            return
        }
        // Coordinates are resolved locally (the web client does the same before hitting the API).
        parseCoordinates(term)?.let { coordinate ->
            isSearching = false
            results = listOf(CarSearchResult(term, "", coordinate))
            invalidate()
            return
        }
        isSearching = true
        invalidate()
        backend.search(term, currentLocation(), currentZoom(), simplifiedLanguage()) { found ->
            // Ignore stale responses if the query moved on while the request was in flight.
            if (latestQuery == term) {
                results = found
                isSearching = false
                invalidate()
            }
        }
    }

    private fun onResultSelected(result: CarSearchResult) {
        val origin = currentLocation()
        if (origin == null) {
            CarToast.makeText(
                            carContext,
                            translations.getString("Unable to find your location..."),
                            CarToast.LENGTH_LONG
                    )
                    .show()
            return
        }
        CarToast.makeText(
                        carContext,
                        translations.getString("Calculating route..."),
                        CarToast.LENGTH_SHORT
                )
                .show()
        backend.route(origin, result.location, ROUTING_TYPE) { points ->
            publishRoute(points)
            screenManager.popToRoot()
        }
    }

    /**
     * Publish the computed route in the same shape the web layer uses (see car.service.ts), so the
     * existing map rendering and travel-estimate logic pick it up unchanged.
     */
    private fun publishRoute(points: List<LatLng>) {
        if (points.isEmpty()) {
            return
        }
        val pointsArray = JSONArray()
        for (point in points) {
            pointsArray.put(JSONArray().put(point.longitude).put(point.latitude))
        }
        val route =
                JSONObject()
                        .put("points", pointsArray)
                        .put("weight", ROUTE_WEIGHT)
                        .put("color", ROUTE_COLOR)
                        .put("opacity", ROUTE_OPACITY)
        val value = JSObject()
        value.put("routes", JSONArray().put(route))
        store.save(CarStoreKeys.ROUTE, value)
    }

    /**
     * Parse a "lat,lng" string into a coordinate, or null when it isn't a valid coordinate pair.
     */
    private fun parseCoordinates(term: String): LatLng? {
        val parts = term.split(",")
        if (parts.size != 2) return null
        val lat = parts[0].trim().toDoubleOrNull() ?: return null
        val lng = parts[1].trim().toDoubleOrNull() ?: return null
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
        return LatLng(lat, lng)
    }

    private fun currentLocation(): LatLng? {
        store.getTransient<Location>(CarStoreKeys.LOCATION)?.let {
            return LatLng(it.latitude, it.longitude)
        }
        val lat = store.loadFloat(CarStoreKeys.LAST_LAT, Float.NaN)
        val lng = store.loadFloat(CarStoreKeys.LAST_LNG, Float.NaN)
        return if (lat.isNaN() || lng.isNaN()) null else LatLng(lat.toDouble(), lng.toDouble())
    }

    private fun currentZoom(): Double = store.loadFloat(CarStoreKeys.ZOOM, DEFAULT_ZOOM).toDouble()

    /**
     * Full language code from config, e.g. "en-US" or "he" — matches the translation file names.
     */
    private fun language(): String =
            store.load(CarStoreKeys.CONFIG)?.optString("language")?.ifEmpty { DEFAULT_LANGUAGE }
                    ?: DEFAULT_LANGUAGE

    /** Region-stripped code for the search API (e.g. "en"), mirroring the web search provider. */
    private fun simplifiedLanguage(): String = language().substringBefore("-")

    companion object {
        private const val ROUTING_TYPE = "4WD"
        private const val ROUTE_COLOR = "#1a73e8"
        private const val ROUTE_WEIGHT = 8.0
        private const val ROUTE_OPACITY = 0.8
        private const val DEFAULT_ZOOM = 14f
        private const val DEFAULT_LANGUAGE = "en-US"
    }
}
