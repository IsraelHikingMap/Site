package com.mapeak.car

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.BitmapFactory
import android.graphics.Paint
import android.graphics.PointF
import android.location.Location
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.widget.FrameLayout
import android.widget.TextView
import androidx.annotation.MainThread
import androidx.car.app.CarContext
import com.getcapacitor.JSObject
import com.mapeak.car.CarMessageBus.CarEvent
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
import org.maplibre.geojson.Polygon
import java.io.IOException
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.sin

class CarMapContainer(private val carContext: CarContext) {
    private var mapViewInstance: MapView? = null
    var mapLibreMapInstance: MapLibreMap? = null
    private var scaleAnimator: Animator? = null

    fun scrollBy(x: Float, y: Float) {
        if (mapLibreMapInstance == null) {
            return
        }
        mapLibreMapInstance!!.scrollBy(-x, -y, 0)
        raiseMoveEnd()
    }

    fun setGpsLocation(location: Location) {
        if (mapLibreMapInstance == null) {
            return
        }
        mapLibreMapInstance!!.getStyle { style: Style? ->
            val pointFeature = Feature.fromGeometry(
                Point.fromLngLat(location.longitude, location.latitude)
            )
            if (location.hasBearing()) {
                pointFeature.properties()!!.addProperty("heading", location.bearing)
            }

            val circleFeature = Feature.fromGeometry(
                createGeoJsonCircle(
                    location.longitude,
                    location.latitude,
                    location.accuracy.toDouble()
                )
            )

            val featureCollection = FeatureCollection.fromFeatures(
                arrayOf<Feature>(circleFeature, pointFeature)
            )

            // Add or update the source
            val existingSource = style!!.getSource(LOCATION_SOURCE_ID) as GeoJsonSource?
            if (existingSource != null) {
                existingSource.setGeoJson(featureCollection)
            } else {
                val locationSource = GeoJsonSource(LOCATION_SOURCE_ID, featureCollection)
                style.addSource(locationSource)
                addLocationLayers(style)
            }
        }
    }

    fun removeGPSLocation() {
        if (mapLibreMapInstance == null) {
            return
        }
        mapLibreMapInstance!!.getStyle { style: Style? ->
            style!!.removeLayer(LOCATION_ICON_LAYER_ID)
            style.removeLayer(LOCATION_CIRCLE_LAYER_ID)
            style.removeLayer(LOCATION_CIRCLE_STROKE_LAYER_ID)
            style.removeSource(LOCATION_SOURCE_ID)
        }
    }

    fun setCenterAndZoom(lat: Double, lng: Double, zoom: Double?, bearing: Double, offsetY: Int) {
        if (mapLibreMapInstance == null) {
            return
        }

        val effectiveZoom =
            zoom ?: mapLibreMapInstance!!.cameraPosition.zoom
        val center = mapLibreMapInstance!!.cameraPosition.target
        if (abs(center!!.latitude - lat) < 1e-6 && abs(center.longitude - lng) < 1e-6 && abs(
                mapLibreMapInstance!!.cameraPosition.zoom - effectiveZoom
            ) < 1e-3
        ) {
            return
        }
        var latLng = LatLng(lat, lng)
        val point = mapLibreMapInstance!!.projection.toScreenLocation(latLng)
        point.y -= offsetY.toFloat()
        latLng = mapLibreMapInstance!!.projection.fromScreenLocation(point)
        val positionBuilder = CameraPosition.Builder()
            .target(latLng)
            .zoom(effectiveZoom)
            .bearing(bearing)
        mapLibreMapInstance!!.easeCamera(newCameraPosition(positionBuilder.build()), 250)
    }

    /**
     * Creates a GeoJSON Polygon approximating a circle, equivalent to
     * turf.circle().
     *
     * @param lng          Center longitude in degrees
     * @param lat          Center latitude in degrees
     * @param radiusMeters Radius in meters (e.g. from Location.getAccuracy())
     * @return A Polygon with CIRCLE_STEPS points + closing point
     */
    private fun createGeoJsonCircle(lng: Double, lat: Double, radiusMeters: Double): Polygon {
        val points: MutableList<Point?> = ArrayList(CIRCLE_STEPS + 1)

        // Earth's radius in meters (WGS-84 mean)
        val earthRadius = 6378137.0

        val latRad = Math.toRadians(lat)
        val lngRad = Math.toRadians(lng)
        // Angular radius on the sphere
        val angularRadius = radiusMeters / earthRadius

        for (i in 0..<CIRCLE_STEPS) {
            // Bearing for this step, evenly distributed around 360°
            val bearing = Math.toRadians((360.0 / CIRCLE_STEPS) * i)

            // Spherical destination formula (same as turf.destination)
            val pointLat = asin(
                sin(latRad) * cos(angularRadius)
                        + cos(latRad) * sin(angularRadius) * cos(bearing)
            )
            val pointLng = lngRad + atan2(
                sin(bearing) * sin(angularRadius) * cos(latRad),
                cos(angularRadius) - sin(latRad) * sin(pointLat)
            )

            points.add(Point.fromLngLat(Math.toDegrees(pointLng), Math.toDegrees(pointLat)))
        }

        // Close the ring
        points.add(points[0])

        return Polygon.fromLngLats(mutableListOf<MutableList<Point?>?>(points))
    }

    private fun addLocationLayers(style: Style) {
        val isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"))
        val isPolygon = Expression.eq(Expression.geometryType(), Expression.literal("Polygon"))

        val gpsIconLayer = SymbolLayer(LOCATION_ICON_LAYER_ID, LOCATION_SOURCE_ID)
        gpsIconLayer.setFilter(isPoint)
        gpsIconLayer.setProperties(
            PropertyFactory.iconImage(LOCATION_ICON_IMAGE),
            PropertyFactory.iconSize(1.0f),
            PropertyFactory.iconRotate(Expression.get("heading")),
            PropertyFactory.iconRotationAlignment(Property.ICON_ROTATION_ALIGNMENT_MAP),
            PropertyFactory.iconIgnorePlacement(true),
            PropertyFactory.iconAllowOverlap(true)
        )
        style.addLayer(gpsIconLayer)

        val accuracyCircleLayer = FillLayer(LOCATION_CIRCLE_LAYER_ID, LOCATION_SOURCE_ID)
        accuracyCircleLayer.setFilter(isPolygon)
        accuracyCircleLayer.setProperties(
            PropertyFactory.fillColor("#136AEC"),
            PropertyFactory.fillOutlineColor("#136AEC"),
            PropertyFactory.fillOpacity(0.2f)
        )
        style.addLayer(accuracyCircleLayer)

        val accuracyCircleStrokeLayer =
            LineLayer(LOCATION_CIRCLE_STROKE_LAYER_ID, LOCATION_SOURCE_ID)
        accuracyCircleStrokeLayer.setFilter(isPolygon)
        accuracyCircleStrokeLayer.setProperties(
            PropertyFactory.lineColor("#136AEC"),
            PropertyFactory.lineWidth(2f)
        )
        style.addLayer(accuracyCircleStrokeLayer)
    }

    fun setRoute(points: ArrayList<LatLng>, weight: Double, color: String?, opacity: Double) {
        if (mapLibreMapInstance == null) {
            return
        }
        mapLibreMapInstance!!.getStyle { style: Style? ->
            val geoJsonPoints: MutableList<Point?> = ArrayList()
            for (latLng in points) {
                geoJsonPoints.add(Point.fromLngLat(latLng.longitude, latLng.latitude))
            }

            val featureCollection: FeatureCollection?
            if (points.isEmpty()) {
                featureCollection = FeatureCollection.fromFeatures(arrayOfNulls<Feature>(0))
            } else {
                val lineString = LineString.fromLngLats(geoJsonPoints)
                val routeFeature = Feature.fromGeometry(lineString)
                routeFeature.properties()!!.addProperty("weight", weight)
                routeFeature.properties()!!.addProperty("color", color)
                routeFeature.properties()!!.addProperty("opacity", opacity)

                val startPointFeature = Feature
                    .fromGeometry(Point.fromLngLat(points[0].longitude, points[0].latitude))
                startPointFeature.properties()!!.addProperty("color", "#43a047")
                startPointFeature.properties()!!.addProperty("strokeColor", "white")

                val endPointFeature = Feature.fromGeometry(
                    Point.fromLngLat(
                        points[points.size - 1].longitude,
                        points[points.size - 1].latitude
                    )
                )
                endPointFeature.properties()!!.addProperty("color", "red")
                endPointFeature.properties()!!.addProperty("strokeColor", "white")

                featureCollection = FeatureCollection
                    .fromFeatures(
                        arrayOf<Feature>(
                            routeFeature,
                            startPointFeature,
                            endPointFeature
                        )
                    )
            }

            val routeSource = style!!.getSourceAs<GeoJsonSource?>(ROUTE_SOURCE_ID)

            if (routeSource != null) {
                routeSource.setGeoJson(featureCollection)
                return@getStyle
            }

            val newSource = GeoJsonSource(ROUTE_SOURCE_ID, featureCollection)
            style.addSource(newSource)
            addRouteLayers(style)
        }
    }

    private fun addRouteLayers(style: Style) {
        val isLineString =
            Expression.eq(Expression.geometryType(), Expression.literal("LineString"))
        val isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"))

        val routeLayer = LineLayer(ROUTE_LAYER_ID, ROUTE_SOURCE_ID)
        routeLayer.setFilter(isLineString)
        routeLayer.setProperties(
            PropertyFactory.lineColor(Expression.get("color")),
            PropertyFactory.lineWidth(Expression.get("weight")),
            PropertyFactory.lineOpacity(Expression.get("opacity")),
            PropertyFactory.lineCap(Property.LINE_CAP_BUTT),
            PropertyFactory.lineJoin(Property.LINE_JOIN_BEVEL)
        )
        style.addLayer(routeLayer)

        val routePointsLayer = CircleLayer(ROUTE_POINTS_LAYER_ID, ROUTE_SOURCE_ID)
        routePointsLayer.setFilter(isPoint)
        routePointsLayer.setProperties(
            PropertyFactory.circleColor(Expression.get("color")),
            PropertyFactory.circleRadius(7f),
            PropertyFactory.circleStrokeColor(Expression.get("strokeColor")),
            PropertyFactory.circleStrokeWidth(3f)
        )
        style.addLayer(routePointsLayer)
    }

    private fun createScaleAnimator(
        currentZoom: Double,
        zoomAddition: Double,
        animationFocalPoint: PointF?
    ): Animator {
        val animator = ValueAnimator.ofFloat(
            currentZoom.toFloat(),
            (currentZoom + zoomAddition).toFloat()
        )
        animator.setDuration(MapLibreConstants.ANIMATION_DURATION.toLong())
        animator.interpolator = DecelerateInterpolator()
        animator.addUpdateListener { animation: ValueAnimator? ->
            if (animationFocalPoint != null && mapLibreMapInstance != null) {
                mapLibreMapInstance!!.setZoom(
                    (animation!!.getAnimatedValue() as Float).toDouble(),
                    animationFocalPoint,
                    0
                )
            }
        }
        animator.addListener(object : AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: Animator) {
                raiseMoveEnd()
            }
        })
        return animator
    }

    private fun doubleClickZoomWithAnimation(zoomFocalPoint: PointF?, isZoomIn: Boolean) {
        cancelCurrentAnimator(scaleAnimator)
        if (mapLibreMapInstance != null) {
            val currentZoom = mapLibreMapInstance!!.zoom
            scaleAnimator = createScaleAnimator(
                currentZoom,
                if (isZoomIn) 1.0 else -1.0,
                zoomFocalPoint
            )
            scaleAnimator!!.start()
        }
    }

    private fun cancelCurrentAnimator(animator: Animator?) {
        if (animator != null && animator.isStarted) {
            animator.cancel()
        }
    }

    fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
        if (scaleFactor == DOUBLE_CLICK_FACTOR) {
            doubleClickZoomWithAnimation(PointF(focusX, focusY), true)
            return
        }
        if (scaleFactor == -DOUBLE_CLICK_FACTOR) {
            doubleClickZoomWithAnimation(PointF(focusX, focusY), false)
            return
        }
        if (mapLibreMapInstance != null) {
            val currentZoomLevel = mapLibreMapInstance!!.zoom
            val zoomAdditional = ((ln(scaleFactor.toDouble()) / ln(Math.PI / 2))
                    * MapLibreConstants.ZOOM_RATE)
            mapLibreMapInstance!!.setZoom(
                currentZoomLevel + zoomAdditional,
                PointF(focusX, focusY),
                0
            )
            raiseMoveEnd()
        }
    }

    @MainThread
    fun setupMap(pixelRatio: Float): View {
        MapLibre.getInstance(carContext)
        val client = OkHttpClient.Builder()
            .addInterceptor(SliceProtocolInterceptor(PmTilesService(carContext)))
            .build()
        HttpRequestUtil.setOkHttpClient(client)

        val mapView = createMapViewInstance(pixelRatio)
        mapView.onStart()
        mapView.getMapAsync { map: MapLibreMap? ->
            mapViewInstance = mapView
            mapLibreMapInstance = map
        }
        mapViewInstance = mapView

        val attribution = TextView(carContext)
        attribution.text = "© OpenStreetMap"
        attribution.setTextColor(0x7B996A74)

        val frameLayout = FrameLayout(carContext)
        frameLayout.addView(
            mapView,
            ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        frameLayout.addView(
            attribution,
            FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM or Gravity.END
            )
        )

        return frameLayout
    }

    @MainThread
    fun cleanUpMap() {
        if (mapViewInstance == null) {
            return
        }

        mapLibreMapInstance = null

        mapViewInstance!!.onPause()
        mapViewInstance!!.onStop()

        try {
            (carContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(
                mapViewInstance
            )
        } catch (_: IllegalArgumentException) {
        }

        mapViewInstance!!.onDestroy()
        mapViewInstance = null
    }

    private fun createMapViewInstance(pixelRatio: Float): MapView {
        val options = MapLibreMapOptions.createFromAttributes(carContext)
        options.pixelRatio(pixelRatio)
        val mapView = MapView(carContext, options)
        mapView.setLayerType(View.LAYER_TYPE_HARDWARE, Paint())
        return mapView
    }

    private fun raiseMoveEnd() {
        if (mapLibreMapInstance == null) {
            return
        }

        val payload = JSObject()
        val mapCenter = mapLibreMapInstance!!.cameraPosition.target
        payload.put("zoom", mapLibreMapInstance!!.cameraPosition.zoom)
        payload.put("lng", mapCenter!!.longitude)
        payload.put("lat", mapCenter.latitude)

        CarMessageBus.instance.emitEvent(CarEvent(CarMessageBus.EVENT_MOVEEND, payload))
    }

    fun setStyle(styleData: JSObject) {
        if (mapLibreMapInstance == null) {
            return
        }

        mapLibreMapInstance!!.setStyle(Style.Builder().fromJson(styleData.toString()))
        mapLibreMapInstance!!.getStyle { style: Style? ->
            try {
                val inputStream = carContext.assets.open("public/content/gps-arrow.png")
                val bitmap = BitmapFactory.decodeStream(inputStream)
                style!!.addImage(LOCATION_ICON_IMAGE, bitmap)
                inputStream.close()
            } catch (_: IOException) {
            }
        }
    }

    companion object {
        private const val LOCATION_SOURCE_ID = "location-source"
        private const val LOCATION_ICON_LAYER_ID = "location-icon-layer"
        private const val LOCATION_CIRCLE_LAYER_ID = "location-accuracy-circle-layer"
        private const val LOCATION_CIRCLE_STROKE_LAYER_ID = "location-accuracy-circle-stroke-layer"
        private const val ROUTE_SOURCE_ID = "planned-route-source"
        private const val ROUTE_LAYER_ID = "planned-route-layer"
        private const val ROUTE_POINTS_LAYER_ID = "planned-route-points-layer"
        private const val LOCATION_ICON_IMAGE = "gps-arrow"
        private const val CIRCLE_STEPS = 64
        const val DOUBLE_CLICK_FACTOR: Float = 2.0f
    }
}