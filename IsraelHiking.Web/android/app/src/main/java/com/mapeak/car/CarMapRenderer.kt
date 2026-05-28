package com.mapeak.car

import android.app.Presentation
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
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
import kotlin.math.max
import kotlin.math.min

class CarMapRenderer(private val carContext: CarContext, serviceLifecycle: Lifecycle) :
        SurfaceCallback, DefaultLifecycleObserver {
    private val mapContainer: CarMapContainer = CarMapContainer(carContext)
    private val store: CarStore = CarStore.get(carContext)
    private var surfaceContainer: SurfaceContainer? = null
    private val uiHandler = Handler(Looper.getMainLooper())
    private var presentation: Presentation? = null
    private var virtualDisplay: VirtualDisplay? = null

    init {
        serviceLifecycle.addObserver(this)
    }

    override fun onCreate(owner: LifecycleOwner) {
        super.onCreate(owner)
        try {
            (carContext.getCarService(CarContext.APP_SERVICE) as AppManager).setSurfaceCallback(
                    this
            )
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Could not set surface callback", e)
        }
    }

    override fun onDestroy(owner: LifecycleOwner) {
        Log.v(LOG_TAG, "CarMapRenderer.onDestroy")
        mapContainer.cleanUpMap()
        surfaceContainer = null

        uiHandler.removeCallbacksAndMessages(null)
        try {
            (carContext.getCarService(CarContext.APP_SERVICE) as AppManager).setSurfaceCallback(
                    null
            )
        } catch (e: Exception) {
            Log.e(LOG_TAG, "Could not remove surface callback", e)
        }
    }

    override fun onSurfaceAvailable(surfaceContainer: SurfaceContainer) {
        Log.v(LOG_TAG, "CarMapRenderer.onSurfaceAvailable")
        this.surfaceContainer = surfaceContainer

        val display =
                carContext
                        .getSystemService(DisplayManager::class.java)
                        .createVirtualDisplay(
                                "MapLibreSampleVirtualDisplay",
                                surfaceContainer.width,
                                surfaceContainer.height,
                                surfaceContainer.dpi,
                                surfaceContainer.surface,
                                0
                        )
        virtualDisplay = display

        presentation =
                Presentation(carContext, display.display).apply {
                    setContentView(mapContainer.setupMap(computePixelRatio(surfaceContainer)))
                    show()
                }
        store.setConnected(true)
    }

    override fun onSurfaceDestroyed(surfaceContainer: SurfaceContainer) {
        Log.v(LOG_TAG, "Surface destroyed")
        this.surfaceContainer = null
        uiHandler.removeCallbacksAndMessages(null)
        store.setConnected(false)
    }

    private fun computePixelRatio(surface: SurfaceContainer): Float {
        val dpi = surface.dpi
        if (dpi <= 0) {
            return 1f
        }
        val widthInches = surface.width.toFloat() / dpi
        val ratio = widthInches / 6f
        return max(1f, min(2.5f, ratio))
    }

    fun zoomInFromButton() = zoomFromButton(CarMapContainer.DOUBLE_CLICK_FACTOR)

    fun zoomOutFromButton() = zoomFromButton(-CarMapContainer.DOUBLE_CLICK_FACTOR)

    private fun zoomFromButton(factor: Float) {
        val surface = surfaceContainer ?: return
        onScale(surface.width / 2f, surface.height / 2f, factor)
    }

    override fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
        mapContainer.onScale(focusX, focusY, scaleFactor)
    }

    @Synchronized
    override fun onScroll(distanceX: Float, distanceY: Float) {
        Log.v(LOG_TAG, "onScroll distanceX($distanceX) distanceY($distanceY)")
        mapContainer.scrollBy(distanceX, distanceY)
    }

    fun recenterFromButton() {
        mapContainer.recenter()
    }

    companion object {
        const val LOG_TAG: String = "CarMapRenderer"
    }
}
