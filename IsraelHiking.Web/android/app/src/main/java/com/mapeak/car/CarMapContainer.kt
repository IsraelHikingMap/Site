package com.mapeak.car

import android.animation.Animator
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.PointF
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
import okhttp3.OkHttpClient
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
import java.io.IOException
import kotlin.math.abs
import kotlin.math.ln

class CarMapContainer(private val carContext: CarContext) : CarStore.Listener {
    private val store: CarStore = CarStore.get(carContext)
    private var mapViewInstance: MapView? = null
    private var mapLibreMapInstance: MapLibreMap? = null
    private var scaleAnimator: Animator? = null
    private var routes: List<CarRouteData> = emptyList()
    private var lastUserInteractionMs: Long = 0L
    private var lastSavedZoom: Double = Double.NaN

    fun scrollBy(x: Float, y: Float) {
        lastUserInteractionMs = System.currentTimeMillis()
        mapLibreMapInstance?.scrollBy(-x, -y, 0)
    }

    fun recenter() {
        lastUserInteractionMs = 0L
        store.getLocation()?.let { centerOnLocation(it) }
    }

    private fun centerOnLocation(location: Location) {
        val bearing = if (location.hasBearing()) location.bearing.toDouble() else 0.0
        // Push the GPS dot into the bottom third so most of the visible map shows what's ahead.
        val offsetY = (mapViewInstance?.height ?: 0) / 6
        setCenterAndZoom(location.latitude, location.longitude, null, bearing, offsetY)
    }

    override fun onCarStoreUpdated(key: String) {
        when (key) {
            CarStore.KEY_STYLE -> store.loadStyle()?.let { setStyle(it) }
            CarStore.KEY_ROUTE -> setRoutes(CarRouteData.listFromJson(store.loadRoutes()))
            CarStore.KEY_LOCATION -> handleLocationUpdate()
        }
    }

    private fun handleLocationUpdate() {
        mapLibreMapInstance?.getStyle { style: Style? -> style?.let { renderGpsLocation(it) } }
        val location = store.getLocation() ?: return
        if (System.currentTimeMillis() - lastUserInteractionMs >= PAN_SUPPRESSION_MS) {
            centerOnLocation(location)
        }
    }

    private fun renderGpsLocation(style: Style) {
        val location = store.getLocation()
        if (location == null) {
            if (style.getSource(LOCATION_SOURCE_ID) != null) {
                style.removeLayer(LOCATION_ICON_LAYER_ID)
                style.removeLayer(LOCATION_CIRCLE_LAYER_ID)
                style.removeLayer(LOCATION_CIRCLE_STROKE_LAYER_ID)
                style.removeSource(LOCATION_SOURCE_ID)
            }
            return
        }

        val pointFeature = Feature.fromGeometry(
            Point.fromLngLat(location.longitude, location.latitude)
        ).apply {
            if (location.hasBearing()) {
                properties()!!.addProperty("heading", location.bearing)
            }
        }

        val circleFeature = Feature.fromGeometry(
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

    fun setCenterAndZoom(lat: Double, lng: Double, zoom: Double?, bearing: Double, offsetY: Int) {
        val map = mapLibreMapInstance ?: return
        val effectiveZoom = zoom ?: map.cameraPosition.zoom
        if (cameraPositionMatches(map.cameraPosition, lat, lng, effectiveZoom)) {
            return
        }
        val projection = map.projection
        val screenPoint = projection.toScreenLocation(LatLng(lat, lng)).apply {
            y -= offsetY.toFloat()
        }
        val newTarget = projection.fromScreenLocation(screenPoint)
        val nextPosition = CameraPosition.Builder()
            .target(newTarget)
            .zoom(effectiveZoom)
            .bearing(bearing)
            .build()
        map.easeCamera(newCameraPosition(nextPosition), CAMERA_EASE_DURATION_MS)
    }

    private fun cameraPositionMatches(
        position: CameraPosition,
        lat: Double,
        lng: Double,
        zoom: Double
    ): Boolean {
        val target = position.target ?: return false
        return abs(target.latitude - lat) < LATLNG_EPSILON &&
            abs(target.longitude - lng) < LATLNG_EPSILON &&
            abs(position.zoom - zoom) < ZOOM_EPSILON
    }

    private fun addLocationLayers(style: Style) {
        val isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"))
        val isPolygon = Expression.eq(Expression.geometryType(), Expression.literal("Polygon"))

        val gpsIconLayer = SymbolLayer(LOCATION_ICON_LAYER_ID, LOCATION_SOURCE_ID).apply {
            setFilter(isPoint)
            setProperties(
                PropertyFactory.iconImage(LOCATION_ICON_IMAGE),
                PropertyFactory.iconSize(1.0f),
                PropertyFactory.iconRotate(Expression.get("heading")),
                PropertyFactory.iconRotationAlignment(Property.ICON_ROTATION_ALIGNMENT_MAP),
                PropertyFactory.iconIgnorePlacement(true),
                PropertyFactory.iconAllowOverlap(true)
            )
        }

        val accuracyCircleLayer = FillLayer(LOCATION_CIRCLE_LAYER_ID, LOCATION_SOURCE_ID).apply {
            setFilter(isPolygon)
            setProperties(
                PropertyFactory.fillColor(LOCATION_ACCURACY_COLOR),
                PropertyFactory.fillOutlineColor(LOCATION_ACCURACY_COLOR),
                PropertyFactory.fillOpacity(0.2f)
            )
        }

        val accuracyCircleStrokeLayer = LineLayer(LOCATION_CIRCLE_STROKE_LAYER_ID, LOCATION_SOURCE_ID).apply {
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
        val features = routes
            .filter { it.lngLats.isNotEmpty() }
            .flatMap { route -> featuresForRoute(route) }
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

        val routeFeature = Feature.fromGeometry(LineString.fromLngLats(geoJsonPoints)).apply {
            properties()!!.apply {
                addProperty("weight", route.weight)
                addProperty("color", route.color)
                addProperty("opacity", route.opacity)
            }
        }
        val startPointFeature = Feature.fromGeometry(geoJsonPoints.first()).apply {
            properties()!!.apply {
                addProperty("color", ROUTE_START_COLOR)
                addProperty("strokeColor", "white")
            }
        }
        val endPointFeature = Feature.fromGeometry(geoJsonPoints.last()).apply {
            properties()!!.apply {
                addProperty("color", ROUTE_END_COLOR)
                addProperty("strokeColor", "white")
            }
        }
        return listOf(routeFeature, startPointFeature, endPointFeature)
    }

    private fun addRouteLayers(style: Style) {
        val isLineString = Expression.eq(Expression.geometryType(), Expression.literal("LineString"))
        val isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"))

        val routeLayer = LineLayer(ROUTE_LAYER_ID, ROUTE_SOURCE_ID).apply {
            setFilter(isLineString)
            setProperties(
                PropertyFactory.lineColor(Expression.get("color")),
                PropertyFactory.lineWidth(Expression.get("weight")),
                PropertyFactory.lineOpacity(Expression.get("opacity")),
                PropertyFactory.lineCap(Property.LINE_CAP_BUTT),
                PropertyFactory.lineJoin(Property.LINE_JOIN_BEVEL)
            )
        }

        val routePointsLayer = CircleLayer(ROUTE_POINTS_LAYER_ID, ROUTE_SOURCE_ID).apply {
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
            style.addLayerAbove(routePointsLayer, ROUTE_LAYER_ID)
        } else {
            style.addLayer(routeLayer)
            style.addLayer(routePointsLayer)
        }
    }

    private fun createScaleAnimator(
        currentZoom: Double,
        zoomAddition: Double,
        animationFocalPoint: PointF
    ): Animator =
        ValueAnimator.ofFloat(currentZoom.toFloat(), (currentZoom + zoomAddition).toFloat()).apply {
            duration = MapLibreConstants.ANIMATION_DURATION.toLong()
            interpolator = DecelerateInterpolator()
            addUpdateListener { animation ->
                mapLibreMapInstance?.setZoom(
                    (animation.animatedValue as Float).toDouble(),
                    animationFocalPoint,
                    0
                )
            }
        }

    private fun doubleClickZoomWithAnimation(zoomFocalPoint: PointF, isZoomIn: Boolean) {
        scaleAnimator?.takeIf { it.isStarted }?.cancel()
        val map = mapLibreMapInstance ?: return
        scaleAnimator = createScaleAnimator(
            map.zoom,
            if (isZoomIn) 1.0 else -1.0,
            zoomFocalPoint
        ).also { it.start() }
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
        val zoomAdditional = (ln(scaleFactor.toDouble()) / ln(Math.PI / 2)) *
            MapLibreConstants.ZOOM_RATE
        map.setZoom(map.zoom + zoomAdditional, focal, 0)
    }

    @MainThread
    fun setupMap(pixelRatio: Float): View {
        MapLibre.getInstance(carContext)
        HttpRequestUtil.setOkHttpClient(
            OkHttpClient.Builder()
                .addInterceptor(SliceProtocolInterceptor(PmTilesService(carContext)))
                .build()
        )
        routes = CarRouteData.listFromJson(store.loadRoutes())

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
        store.loadZoom()?.let { savedZoom ->
            map.cameraPosition = CameraPosition.Builder(map.cameraPosition)
                .zoom(savedZoom)
                .build()
        }
        map.addOnCameraIdleListener {
            val zoom = map.cameraPosition.zoom
            if (zoom != lastSavedZoom) {
                lastSavedZoom = zoom
                store.saveZoom(zoom)
            }
        }
        store.loadStyle()?.let { setStyle(it) }
    }

    @MainThread
    fun cleanUpMap() {
        store.removeListener(this)
        val mapView = mapViewInstance ?: return
        mapLibreMapInstance = null
        mapView.onPause()
        mapView.onStop()
        try {
            (carContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(mapView)
        } catch (_: IllegalArgumentException) {
        }
        mapView.onDestroy()
        mapViewInstance = null
    }

    private fun createMapViewInstance(pixelRatio: Float): MapView {
        val options = MapLibreMapOptions.createFromAttributes(carContext).pixelRatio(pixelRatio)
        return MapView(carContext, options).apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, Paint())
        }
    }

    fun setStyle(styleJson: String) {
        val map = mapLibreMapInstance ?: return
        map.setStyle(Style.Builder().fromJson(styleJson)) { style: Style ->
            try {
                carContext.assets.open("public/content/gps-arrow.png").use { input ->
                    style.addImage(LOCATION_ICON_IMAGE, BitmapFactory.decodeStream(input))
                }
            } catch (e: IOException) {
                Log.w(LOG_TAG, "Could not load GPS arrow asset", e)
            }
            renderRoutes(style)
            renderGpsLocation(style)
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
        private const val ROUTE_POINTS_LAYER_ID = "planned-route-points-layer"
        private const val ROUTE_START_COLOR = "#43a047"
        private const val ROUTE_END_COLOR = "red"
        private const val CIRCLE_STEPS = 64
        private const val PAN_SUPPRESSION_MS = 15_000L
        private const val CAMERA_EASE_DURATION_MS = 250
        private const val LATLNG_EPSILON = 1e-6
        private const val ZOOM_EPSILON = 1e-3
        private const val ATTRIBUTION_COLOR = 0x7B996A74.toInt()
        const val DOUBLE_CLICK_FACTOR: Float = 2.0f

        // Injected into every stored style by CarStore.saveStyle so that
        // location layers can be added above and route layers below.
        const val LAYERING_ANCHOR_ID: String = "car-layering-anchor"
        const val LAYERING_ANCHOR_SOURCE_ID: String = "car-layering-anchor-source"
    }
}
