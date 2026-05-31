package com.mapeak.car

import android.animation.Animator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PointF
import android.graphics.Rect
import android.location.Location
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.TextView
import androidx.annotation.MainThread
import androidx.car.app.CarContext
import androidx.core.animation.doOnEnd
import java.io.IOException
import kotlin.math.ln
import kotlin.math.pow
import okhttp3.OkHttpClient
import org.json.JSONArray
import org.json.JSONObject
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory.newCameraPosition
import org.maplibre.android.constants.MapLibreConstants
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapLibreMapOptions
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import org.maplibre.android.module.http.HttpRequestUtil
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.Feature
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.LineString
import org.maplibre.geojson.Point
import org.maplibre.turf.TurfConstants
import org.maplibre.turf.TurfTransformation

class CarMapContainer(private val carContext: CarContext) : CapacitorStore.Listener {
    private val store: CarStore = CarStore.get(carContext)
    private var mapViewInstance: MapView? = null
    private var mapLibreMapInstance: MapLibreMap? = null
    private var scaleAnimator: Animator? = null
    private var routes: List<CarRouteData> = emptyList()
    private var lastUserInteractionMs: Long = 0L
    private var lastSavedZoom: Double = Double.NaN
    private var visibleArea: Rect? = null

    fun scrollBy(x: Float, y: Float) {
        lastUserInteractionMs = System.currentTimeMillis()
        mapLibreMapInstance?.scrollBy(-x, -y, 0)
    }

    fun recenter() {
        lastUserInteractionMs = 0L
        currentLocation()?.let { centerOnLocation(it) }
    }

    private fun centerOnLocation(location: Location) {
        val bearing = if (location.hasBearing()) location.bearing.toDouble() else 0.0
        val view = mapViewInstance ?: return
        // Push the GPS dot into the bottom third of the visible area so what's ahead stays in view
        // and the dot can't slip under another app docked on the Android Auto surface.
        val area = visibleArea?.takeIf { !it.isEmpty } ?: Rect(0, 0, view.width, view.height)
        val anchorX = area.exactCenterX()
        val anchorY = area.exactCenterY() + area.height() / 6f
        setCenter(location.latitude, location.longitude, bearing, anchorX, anchorY)
    }

    fun onVisibleAreaChanged(area: Rect) {
        visibleArea = Rect(area)
        currentLocation()?.let { centerOnLocation(it) }
    }

    private fun currentLocation(): Location? = store.getTransient(CarStoreKeys.LOCATION)

    override fun onCarStoreUpdated(key: String) {
        when (key) {
            CarStoreKeys.STYLE -> setStyle(store.loadString(CarStoreKeys.STYLE))
            CarStoreKeys.ROUTE ->
                    setRoutes(CarRouteData.listFromJson(store.load(CarStoreKeys.ROUTE)))
            CarStoreKeys.LOCATION -> handleLocationUpdate()
        }
    }

    private fun handleLocationUpdate() {
        mapLibreMapInstance?.getStyle { style: Style? -> style?.let { renderGpsLocation(it) } }
        val location = currentLocation() ?: return
        if (System.currentTimeMillis() - lastUserInteractionMs >= PAN_SUPPRESSION_MS) {
            centerOnLocation(location)
        }
    }

    private fun renderGpsLocation(style: Style) {
        val location = currentLocation()
        if (location == null) {
            if (style.getSource(LOCATION_SOURCE_ID) != null) {
                style.removeLayer(LOCATION_ICON_LAYER_ID)
                style.removeLayer(LOCATION_CIRCLE_LAYER_ID)
                style.removeLayer(LOCATION_CIRCLE_STROKE_LAYER_ID)
                style.removeSource(LOCATION_SOURCE_ID)
            }
            return
        }

        val pointFeature =
                Feature.fromGeometry(Point.fromLngLat(location.longitude, location.latitude))
                        .apply {
                            if (location.hasBearing()) {
                                properties()!!.addProperty("heading", location.bearing)
                            }
                        }

        val circleFeature =
                Feature.fromGeometry(
                        TurfTransformation.circle(
                                Point.fromLngLat(location.longitude, location.latitude),
                                location.accuracy.toDouble(),
                                CIRCLE_STEPS,
                                TurfConstants.UNIT_METERS
                        )
                )

        val featureCollection = FeatureCollection.fromFeatures(arrayOf(circleFeature, pointFeature))

        val existingSource = style.getSourceAs<GeoJsonSource>(LOCATION_SOURCE_ID)
        if (existingSource != null) {
            existingSource.setGeoJson(featureCollection)
        } else {
            style.addSource(GeoJsonSource(LOCATION_SOURCE_ID, featureCollection))
            addLocationLayers(style)
        }
    }

    fun setCenter(lat: Double, lng: Double, bearing: Double, anchorX: Float, anchorY: Float) {
        val map = mapLibreMapInstance ?: return
        val view = mapViewInstance ?: return
        val projection = map.projection
        // Camera target lands at the view's geometric center. Shift it so the requested lat/lng
        // appears at (anchorX, anchorY) instead.
        val currentScreen = projection.toScreenLocation(LatLng(lat, lng))
        val targetScreen =
                PointF(
                        currentScreen.x - (anchorX - view.width / 2f),
                        currentScreen.y - (anchorY - view.height / 2f)
                )
        val newTarget = projection.fromScreenLocation(targetScreen)
        val nextPosition = CameraPosition.Builder().target(newTarget).bearing(bearing).build()
        map.easeCamera(newCameraPosition(nextPosition), CAMERA_EASE_DURATION_MS)
    }

    private fun addLocationLayers(style: Style) {
        val isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"))
        val isPolygon = Expression.eq(Expression.geometryType(), Expression.literal("Polygon"))

        val gpsIconLayer =
                SymbolLayer(LOCATION_ICON_LAYER_ID, LOCATION_SOURCE_ID).apply {
                    setFilter(isPoint)
                    setProperties(
                            PropertyFactory.iconImage(LOCATION_ICON_IMAGE),
                            PropertyFactory.iconSize(1.0f),
                            PropertyFactory.iconRotate(Expression.get("heading")),
                            PropertyFactory.iconRotationAlignment(
                                    Property.ICON_ROTATION_ALIGNMENT_MAP
                            ),
                            PropertyFactory.iconIgnorePlacement(true),
                            PropertyFactory.iconAllowOverlap(true)
                    )
                }

        val accuracyCircleLayer =
                FillLayer(LOCATION_CIRCLE_LAYER_ID, LOCATION_SOURCE_ID).apply {
                    setFilter(isPolygon)
                    setProperties(
                            PropertyFactory.fillColor(LOCATION_ACCURACY_COLOR),
                            PropertyFactory.fillOutlineColor(LOCATION_ACCURACY_COLOR),
                            PropertyFactory.fillOpacity(0.2f)
                    )
                }

        val accuracyCircleStrokeLayer =
                LineLayer(LOCATION_CIRCLE_STROKE_LAYER_ID, LOCATION_SOURCE_ID).apply {
                    setFilter(isPolygon)
                    setProperties(
                            PropertyFactory.lineColor(LOCATION_ACCURACY_COLOR),
                            PropertyFactory.lineWidth(2f)
                    )
                }

        if (style.getLayer(LAYERING_ANCHOR_ID) != null) {
            style.addLayerAbove(accuracyCircleLayer, LAYERING_ANCHOR_ID)
            style.addLayerAbove(accuracyCircleStrokeLayer, LOCATION_CIRCLE_LAYER_ID)
            style.addLayerAbove(gpsIconLayer, LOCATION_CIRCLE_STROKE_LAYER_ID)
        } else {
            style.addLayer(accuracyCircleLayer)
            style.addLayer(accuracyCircleStrokeLayer)
            style.addLayer(gpsIconLayer)
        }
    }

    fun setRoutes(routes: List<CarRouteData>) {
        this.routes = routes
        mapLibreMapInstance?.getStyle { style: Style? -> style?.let { renderRoutes(it) } }
    }

    private fun renderRoutes(style: Style) {
        val features =
                routes.filter { it.lngLats.isNotEmpty() }.flatMap { route ->
                    featuresForRoute(route)
                }
        val featureCollection = FeatureCollection.fromFeatures(features)

        val existingSource = style.getSourceAs<GeoJsonSource>(ROUTE_SOURCE_ID)
        if (existingSource != null) {
            existingSource.setGeoJson(featureCollection)
        } else {
            style.addSource(GeoJsonSource(ROUTE_SOURCE_ID, featureCollection))
            addRouteLayers(style)
        }
    }

    private fun featuresForRoute(route: CarRouteData): List<Feature> {
        val points = route.lngLats
        val geoJsonPoints = points.map { Point.fromLngLat(it.longitude, it.latitude) }

        val routeFeature =
                Feature.fromGeometry(LineString.fromLngLats(geoJsonPoints)).apply {
                    properties()!!.apply {
                        addProperty("weight", route.weight)
                        addProperty("color", route.color)
                        addProperty("opacity", route.opacity)
                        addProperty("iconColor", arrowIconColor(route.color, route.opacity))
                        addProperty("iconSize", arrowIconSize(route.weight))
                    }
                }
        val startPointFeature =
                Feature.fromGeometry(geoJsonPoints.first()).apply {
                    properties()!!.apply {
                        addProperty("color", ROUTE_START_COLOR)
                        addProperty("strokeColor", "white")
                    }
                }
        val endPointFeature =
                Feature.fromGeometry(geoJsonPoints.last()).apply {
                    properties()!!.apply {
                        addProperty("color", ROUTE_END_COLOR)
                        addProperty("strokeColor", "white")
                    }
                }
        return listOf(routeFeature, startPointFeature, endPointFeature)
    }

    /**
     * Mirrors selectedRouteService.routeToProperties: when the route is opaque enough to mask the
     * arrow, return the inverted (b/w) of the route color so the arrow stays visible; otherwise
     * reuse the route color so the arrow blends with the line.
     */
    private fun arrowIconColor(routeColor: String?, opacity: Double): String {
        val color = routeColor ?: return ROUTE_ARROW_FALLBACK_COLOR
        if (opacity <= ARROW_INVERT_OPACITY_THRESHOLD) return color
        val parsed =
                try {
                    Color.parseColor(color)
                } catch (_: IllegalArgumentException) {
                    return color
                }
        val invertedR = 255 - Color.red(parsed)
        val invertedG = 255 - Color.green(parsed)
        val invertedB = 255 - Color.blue(parsed)
        val luminance =
                0.2126 * channelToLinear(invertedR) +
                        0.7152 * channelToLinear(invertedG) +
                        0.0722 * channelToLinear(invertedB)
        return if (luminance < BW_LUMINANCE_THRESHOLD) "#000000" else "#FFFFFF"
    }

    private fun arrowIconSize(weight: Double): Double =
            if (weight < ARROW_BASE_WEIGHT) ARROW_BASE_SIZE
            else ARROW_BASE_SIZE * weight / ARROW_BASE_WEIGHT

    private fun channelToLinear(channel: Int): Double {
        val normalized = channel / 255.0
        return if (normalized <= 0.03928) normalized / 12.92
        else ((normalized + 0.055) / 1.055).pow(2.4)
    }

    private fun addRouteLayers(style: Style) {
        val isLineString =
                Expression.eq(Expression.geometryType(), Expression.literal("LineString"))
        val isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"))

        val routeLayer =
                LineLayer(ROUTE_LAYER_ID, ROUTE_SOURCE_ID).apply {
                    setFilter(isLineString)
                    setProperties(
                            PropertyFactory.lineColor(Expression.get("color")),
                            PropertyFactory.lineWidth(Expression.get("weight")),
                            PropertyFactory.lineOpacity(Expression.get("opacity")),
                            PropertyFactory.lineCap(Property.LINE_CAP_BUTT),
                            PropertyFactory.lineJoin(Property.LINE_JOIN_BEVEL)
                    )
                }

        val routeArrowsLayer =
                SymbolLayer(ROUTE_ARROWS_LAYER_ID, ROUTE_SOURCE_ID).apply {
                    setFilter(isLineString)
                    setProperties(
                            PropertyFactory.symbolPlacement(Property.SYMBOL_PLACEMENT_LINE),
                            PropertyFactory.symbolSpacing(40f),
                            PropertyFactory.iconImage(ROUTE_ARROW_ICON_IMAGE),
                            PropertyFactory.iconSize(Expression.get("iconSize")),
                            PropertyFactory.iconColor(Expression.get("iconColor")),
                            PropertyFactory.iconAllowOverlap(true),
                            PropertyFactory.iconIgnorePlacement(true)
                    )
                }

        val routePointsLayer =
                CircleLayer(ROUTE_POINTS_LAYER_ID, ROUTE_SOURCE_ID).apply {
                    setFilter(isPoint)
                    setProperties(
                            PropertyFactory.circleColor(Expression.get("color")),
                            PropertyFactory.circleRadius(7f),
                            PropertyFactory.circleStrokeColor(Expression.get("strokeColor")),
                            PropertyFactory.circleStrokeWidth(3f)
                    )
                }

        if (style.getLayer(LAYERING_ANCHOR_ID) != null) {
            style.addLayerBelow(routeLayer, LAYERING_ANCHOR_ID)
            style.addLayerAbove(routeArrowsLayer, ROUTE_LAYER_ID)
            style.addLayerAbove(routePointsLayer, ROUTE_ARROWS_LAYER_ID)
        } else {
            style.addLayer(routeLayer)
            style.addLayer(routeArrowsLayer)
            style.addLayer(routePointsLayer)
        }
    }

    private fun persistCurrentZoom() {
        val zoom = mapLibreMapInstance?.cameraPosition?.zoom ?: return
        if (zoom != lastSavedZoom) {
            lastSavedZoom = zoom
            store.saveFloat(CarStoreKeys.ZOOM, zoom.toFloat())
        }
    }

    private fun createScaleAnimator(
            currentZoom: Double,
            zoomAddition: Double,
            animationFocalPoint: PointF
    ): Animator =
            ValueAnimator.ofFloat(currentZoom.toFloat(), (currentZoom + zoomAddition).toFloat())
                    .apply {
                        duration = MapLibreConstants.ANIMATION_DURATION.toLong()
                        interpolator = DecelerateInterpolator()
                        addUpdateListener { animation ->
                            mapLibreMapInstance?.setZoom(
                                    (animation.animatedValue as Float).toDouble(),
                                    animationFocalPoint,
                                    0
                            )
                        }
                        doOnEnd { persistCurrentZoom() }
                    }

    private fun doubleClickZoomWithAnimation(zoomFocalPoint: PointF, isZoomIn: Boolean) {
        scaleAnimator?.takeIf { it.isStarted }?.cancel()
        val map = mapLibreMapInstance ?: return
        scaleAnimator =
                createScaleAnimator(map.zoom, if (isZoomIn) 1.0 else -1.0, zoomFocalPoint).also {
                    it.start()
                }
    }

    fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
        lastUserInteractionMs = System.currentTimeMillis()
        val focal = PointF(focusX, focusY)
        when (scaleFactor) {
            DOUBLE_CLICK_FACTOR -> {
                doubleClickZoomWithAnimation(focal, true)
                return
            }
            -DOUBLE_CLICK_FACTOR -> {
                doubleClickZoomWithAnimation(focal, false)
                return
            }
        }
        val map = mapLibreMapInstance ?: return
        val zoomAdditional =
                (ln(scaleFactor.toDouble()) / ln(Math.PI / 2)) * MapLibreConstants.ZOOM_RATE
        map.setZoom(map.zoom + zoomAdditional, focal, 0)
        persistCurrentZoom()
    }

    @MainThread
    fun setupMap(pixelRatio: Float): View {
        MapLibre.getInstance(carContext)
        HttpRequestUtil.setOkHttpClient(
                OkHttpClient.Builder()
                        .addInterceptor(SliceProtocolInterceptor(PmTilesService(carContext)))
                        .build()
        )
        routes = CarRouteData.listFromJson(store.load(CarStoreKeys.ROUTE))

        val mapView = createMapViewInstance(pixelRatio).apply { onStart() }
        mapViewInstance = mapView
        mapView.getMapAsync { map: MapLibreMap? ->
            mapLibreMapInstance = map
            map?.let { initializeMap(it) }
        }
        store.addListener(this)

        return FrameLayout(carContext).apply {
            addView(
                    mapView,
                    ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                    )
            )
            addView(
                    TextView(carContext).apply {
                        text = "© OpenStreetMap"
                        setTextColor(ATTRIBUTION_COLOR)
                    },
                    FrameLayout.LayoutParams(
                            FrameLayout.LayoutParams.WRAP_CONTENT,
                            FrameLayout.LayoutParams.WRAP_CONTENT,
                            Gravity.BOTTOM or Gravity.END
                    )
            )
        }
    }

    private fun initializeMap(map: MapLibreMap) {
        val initialLocation = currentLocation() ?: loadLastKnownLocation()
        map.cameraPosition =
                CameraPosition.Builder(map.cameraPosition)
                        .zoom(store.loadFloat(CarStoreKeys.ZOOM, DEFAULT_ZOOM).toDouble())
                        .target(LatLng(initialLocation.latitude, initialLocation.longitude))
                        .build()
        setStyle(store.loadString(CarStoreKeys.STYLE))
    }

    /**
     * Last lat/lng we ever received from GPS, used to center the map on launch before a fresh fix
     * arrives. Falls back to London on a cold install with no saved fix so the map never opens at
     * (0, 0). The returned Location only has coordinates — no speed, bearing, or accuracy — so it
     * should not be fed into ETA computation.
     */
    private fun loadLastKnownLocation(): Location =
            Location(LAST_KNOWN_PROVIDER).apply {
                latitude = store.loadFloat(CarStoreKeys.LAST_LAT, DEFAULT_LAT.toFloat()).toDouble()
                longitude = store.loadFloat(CarStoreKeys.LAST_LNG, DEFAULT_LNG.toFloat()).toDouble()
            }

    @MainThread
    fun cleanUpMap() {
        store.removeListener(this)
        val mapView = mapViewInstance ?: return
        mapLibreMapInstance = null
        mapView.onPause()
        mapView.onStop()
        try {
            (carContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(
                    mapView
            )
        } catch (_: IllegalArgumentException) {}
        mapView.onDestroy()
        mapViewInstance = null
    }

    private fun createMapViewInstance(pixelRatio: Float): MapView {
        val options = MapLibreMapOptions.createFromAttributes(carContext).pixelRatio(pixelRatio)
        return MapView(carContext, options).apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, Paint())
        }
    }

    fun setStyle(styleJson: String?) {
        val map = mapLibreMapInstance ?: return
        val builder =
                if (styleJson != null) Style.Builder().fromJson(addLayeringAnchorTo(styleJson))
                else
                        Style.Builder()
                                .fromUri(
                                        "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json"
                                )
        map.setStyle(builder) { style: Style ->
            loadStyleImage(style, "public/content/gps-arrow.png", LOCATION_ICON_IMAGE, sdf = false)
            loadStyleImage(style, "public/content/arrow.png", ROUTE_ARROW_ICON_IMAGE, sdf = true)
            renderRoutes(style)
            renderGpsLocation(style)
        }
    }

    /**
     * Injects an invisible anchor source and layer into the style so that location layers can be
     * added above it and route layers below it (see addLocationLayers / addRouteLayers).
     */
    private fun addLayeringAnchorTo(styleJson: String): String {
        val style = JSONObject(styleJson)
        val sources =
                style.optJSONObject("sources") ?: JSONObject().also { style.put("sources", it) }
        val anchorData = JSONObject().put("type", "FeatureCollection").put("features", JSONArray())
        val anchorSource = JSONObject().put("type", "geojson").put("data", anchorData)
        sources.put(LAYERING_ANCHOR_SOURCE_ID, anchorSource)

        val layers = style.optJSONArray("layers") ?: JSONArray().also { style.put("layers", it) }
        val anchorLayer =
                JSONObject()
                        .put("id", LAYERING_ANCHOR_ID)
                        .put("type", "circle")
                        .put("source", LAYERING_ANCHOR_SOURCE_ID)
                        .put("layout", JSONObject().put("visibility", "none"))
        layers.put(anchorLayer)
        return style.toString()
    }

    private fun loadStyleImage(style: Style, assetPath: String, imageId: String, sdf: Boolean) {
        try {
            carContext.assets.open(assetPath).use { input ->
                style.addImage(imageId, BitmapFactory.decodeStream(input), sdf)
            }
        } catch (e: IOException) {
            Log.w(LOG_TAG, "Could not load asset: $assetPath", e)
        }
    }

    companion object {
        private const val LOG_TAG = "CarMapContainer"
        private const val LOCATION_SOURCE_ID = "location-source"
        private const val LOCATION_ICON_LAYER_ID = "location-icon-layer"
        private const val LOCATION_CIRCLE_LAYER_ID = "location-accuracy-circle-layer"
        private const val LOCATION_CIRCLE_STROKE_LAYER_ID = "location-accuracy-circle-stroke-layer"
        private const val LOCATION_ICON_IMAGE = "gps-arrow"
        private const val LOCATION_ACCURACY_COLOR = "#136AEC"
        private const val ROUTE_SOURCE_ID = "planned-route-source"
        private const val ROUTE_LAYER_ID = "planned-route-layer"
        private const val ROUTE_ARROWS_LAYER_ID = "planned-route-arrows-layer"
        private const val ROUTE_POINTS_LAYER_ID = "planned-route-points-layer"
        private const val ROUTE_START_COLOR = "#43a047"
        private const val ROUTE_END_COLOR = "red"
        private const val ROUTE_ARROW_ICON_IMAGE = "arrow"
        private const val ROUTE_ARROW_FALLBACK_COLOR = "#FFFFFF"
        private const val ARROW_INVERT_OPACITY_THRESHOLD = 0.5
        private const val ARROW_BASE_WEIGHT = 10.0
        private const val ARROW_BASE_SIZE = 1.6
        private const val BW_LUMINANCE_THRESHOLD = 0.1791288
        private const val CIRCLE_STEPS = 64
        private const val DEFAULT_ZOOM = 14f
        // Cold-install fallback so the map never opens at (0, 0); see loadLastKnownLocation.
        private const val LAST_KNOWN_PROVIDER = "saved"
        private const val DEFAULT_LAT = 51.5074
        private const val DEFAULT_LNG = -0.1278
        private const val PAN_SUPPRESSION_MS = 5_000L
        private const val CAMERA_EASE_DURATION_MS = 250
        private const val ATTRIBUTION_COLOR = 0x7B996A74
        const val DOUBLE_CLICK_FACTOR: Float = 2.0f

        // Injected into every style by addLayeringAnchorTo so that
        // location layers can be added above and route layers below.
        const val LAYERING_ANCHOR_ID: String = "car-layering-anchor"
        const val LAYERING_ANCHOR_SOURCE_ID: String = "car-layering-anchor-source"
    }
}
