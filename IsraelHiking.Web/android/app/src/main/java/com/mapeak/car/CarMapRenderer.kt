package com.mapeak.car

import android.app.Presentation
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.location.Location
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.car.app.AppManager
import androidx.car.app.CarContext
import androidx.car.app.SurfaceCallback
import androidx.car.app.SurfaceContainer
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import com.getcapacitor.JSObject
import com.mapeak.car.CarMessageBus.CarEvent
import com.mapeak.car.CarMessageBus.CarEventListener
import org.json.JSONException
import org.maplibre.android.geometry.LatLng
import kotlin.math.max
import kotlin.math.min

class CarMapRenderer(private val carContext: CarContext, serviceLifecycle: Lifecycle) :
    SurfaceCallback, DefaultLifecycleObserver, CarEventListener {
    private val mapContainer: CarMapContainer = CarMapContainer(carContext)
    private var surfaceContainer: SurfaceContainer? = null
    private val uiHandler = Handler(Looper.getMainLooper())
    private var lastKnownStableArea = Rect()
    private var lastKnownVisibleArea = Rect()
    private var presentation: Presentation? = null
    private var virtualDisplay: VirtualDisplay? = null

    init {
        serviceLifecycle.addObserver(this)
    }

    override fun onCreate(owner: LifecycleOwner) {
        super.onCreate(owner)
        try {
            (carContext.getCarService(CarContext.APP_SERVICE) as AppManager).setSurfaceCallback(this)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Could not set surface callback", e)
        }
    }

    override fun onDestroy(owner: LifecycleOwner) {
        Log.v(LOG_TAG, "CarMapRenderer.onDestroy")
        CarMessageBus.instance.unregisterListener(this)
        mapContainer.cleanUpMap()
        surfaceContainer = null

        uiHandler.removeCallbacksAndMessages(null)
        try {
            (carContext.getCarService(CarContext.APP_SERVICE) as AppManager).setSurfaceCallback(null)
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Could not remove surface callback", e)
        }
    }

    override fun onSurfaceAvailable(surfaceContainer: SurfaceContainer) {
        Log.v(LOG_TAG, "CarMapRenderer.onSurfaceAvailable")
        this.surfaceContainer = surfaceContainer

        val virtualDisplay = carContext
            .getSystemService(DisplayManager::class.java)
            .createVirtualDisplay(
                "MapLibreSampleVirtualDisplay",
                surfaceContainer.width,
                surfaceContainer.height,
                surfaceContainer.dpi,
                surfaceContainer.surface,
                0
            )
        this.virtualDisplay = virtualDisplay

        val presentation = Presentation(carContext, virtualDisplay.display)
        this.presentation = presentation
        presentation.setContentView(mapContainer.setupMap(computePixelRatio()))
        presentation.show()
        // Doing this after setting the map will allow playback of the events.
        CarMessageBus.instance.registerListener(this)
        val payload = JSObject()
        payload.put("connected", true)
        CarMessageBus.instance.emitEvent(CarEvent("connected", payload))
    }

    override fun onVisibleAreaChanged(visibleArea: Rect) {
        if (visibleArea != lastKnownVisibleArea) {
            lastKnownVisibleArea = visibleArea
        }
    }

    override fun onStableAreaChanged(stableArea: Rect) {
        if (stableArea != lastKnownStableArea) {
            lastKnownStableArea = stableArea
        }
    }

    override fun onSurfaceDestroyed(surfaceContainer: SurfaceContainer) {
        Log.v(LOG_TAG, "Surface destroyed")
        this.surfaceContainer = null
        uiHandler.removeCallbacksAndMessages(null)
        val payload = JSObject()
        payload.put("connected", false)
        CarMessageBus.instance.emitEvent(CarEvent("connected", payload))
    }

    private fun computePixelRatio(): Float {
        val dpi = surfaceContainer!!.dpi
        if (dpi <= 0) {
            return 1f
        }
        val widthInches = surfaceContainer!!.width.toFloat() / dpi
        val ratio = widthInches / 6f
        return max(1f, min(2.5f, ratio))
    }

    fun zoomInFromButton() {
        val centerX = if (surfaceContainer != null) surfaceContainer!!.width / 2f else -1f
        val centerY = if (surfaceContainer != null) surfaceContainer!!.height / 2f else -1f
        onScale(centerX, centerY, CarMapContainer.DOUBLE_CLICK_FACTOR)
    }

    fun zoomOutFromButton() {
        val centerX = if (surfaceContainer != null) surfaceContainer!!.width / 2f else -1f
        val centerY = if (surfaceContainer != null) surfaceContainer!!.height / 2f else -1f
        onScale(centerX, centerY, -CarMapContainer.DOUBLE_CLICK_FACTOR)
    }

    override fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
        mapContainer.onScale(focusX, focusY, scaleFactor)
    }

    @Synchronized
    override fun onScroll(distanceX: Float, distanceY: Float) {
        Log.v(LOG_TAG, "onScroll distanceX($distanceX) distanceY($distanceY)")
        mapContainer.scrollBy(distanceX, distanceY)
    }

    override fun onCarEvent(event: CarEvent) {
        try {
            when (event.actionId) {
                CarMessageBus.EVENT_LOCATION -> handleGpsPositionEvent(event)
                CarMessageBus.EVENT_ROUTE -> handleRouteEvent(event)
                CarMessageBus.EVENT_STYLE -> {
                    val styleLike = event.payload?.getJSObject("style")
                    mapContainer.setStyle(styleLike!!)
                }

                CarMessageBus.EVENT_CENTER -> handleCenterEvent(event)
            }
        } catch (_: JSONException) {
        }
    }

    @Throws(JSONException::class)
    private fun handleGpsPositionEvent(event: CarEvent) {
        val payload = event.payload
        if (payload == null) {
            mapContainer.removeGPSLocation()
            return
        }

        val location = Location("GPS")
        if (!payload.isNull("bearing")) {
            location.bearing = payload.getDouble("bearing").toFloat()
        }
        location.latitude = payload.getDouble("lat")
        location.longitude = payload.getDouble("lng")
        location.accuracy = payload.getDouble("acc").toFloat()
        mapContainer.setGpsLocation(location)
    }

    @Throws(JSONException::class)
    private fun handleRouteEvent(event: CarEvent) {
        val payload = event.payload!!
        val points = payload.getJSONArray("points")
        val weight = payload.getDouble("weight")
        val color = payload.getString("color")
        val opacity = payload.getDouble("opacity")
        val lngLats = ArrayList<LatLng>()
        for (i in 0..<points.length()) {
            val point = points.getJSONArray(i)
            lngLats.add(LatLng(point.getDouble(1), point.getDouble(0)))
        }
        mapContainer.setRoute(lngLats, weight, color, opacity)
    }

    @Throws(JSONException::class)
    private fun handleCenterEvent(event: CarEvent) {
        val payload = event.payload!!
        val lat = payload.getDouble("lat")
        val lng = payload.getDouble("lng")
        val zoom = if (payload.has("zoom")) payload.getDouble("zoom") else null
        val bearing = if (payload.has("bearing")) payload.getDouble("bearing") else 0.0
        val offsetY = if (payload.has("offsetY")) payload.getInt("offsetY") else 0
        mapContainer.setCenterAndZoom(lat, lng, zoom, bearing, offsetY)
    }

    companion object {
        const val LOG_TAG: String = "CarMapRenderer"
    }
}