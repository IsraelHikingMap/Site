package com.mapeak.car;

import android.app.Presentation;
import android.graphics.Rect;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleOwner;

public class CarMapRenderer implements SurfaceCallback, DefaultLifecycleObserver { // ICarMapRenderer

    public static final String LOG_TAG = "CarMapRenderer";

    private final CarContext carContext;
    private final CarMapContainer mapContainer;
    private SurfaceContainer surfaceContainer = null;
    private final Handler uiHandler = new Handler(Looper.getMainLooper());
    private Rect lastKnownStableArea = new Rect();
    private Rect lastKnownVisibleArea = new Rect();
    private Presentation presentation = null;
    private VirtualDisplay virtualDisplay = null;

    public CarMapRenderer(CarContext carContext, Lifecycle serviceLifecycle) {
        this.carContext = carContext;
        this.mapContainer = new CarMapContainer(carContext);
        serviceLifecycle.addObserver(this);
    }

    @Override
    public void onCreate(@NonNull LifecycleOwner owner) {
        DefaultLifecycleObserver.super.onCreate(owner);
        try {
            ((AppManager) carContext.getCarService(CarContext.APP_SERVICE)).setSurfaceCallback(this);
        } catch (Exception e) {
            Log.e(LOG_TAG, "Could not set surface callback", e);
        }
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        Log.v(LOG_TAG, "CarMapRenderer.onDestroy");
        mapContainer.cleanUpMap();
        surfaceContainer = null;
        uiHandler.removeCallbacksAndMessages(null);
        try {
            ((AppManager) carContext.getCarService(CarContext.APP_SERVICE)).setSurfaceCallback(null);
        } catch (Exception e) {
            Log.e(LOG_TAG, "Could not remove surface callback", e);
        }
    }

    @Override
    public void onSurfaceAvailable(SurfaceContainer surfaceContainer) {
        Log.v(LOG_TAG, "CarMapRenderer.onSurfaceAvailable");
        this.surfaceContainer = surfaceContainer;

        VirtualDisplay virtualDisplay = carContext
                .getSystemService(DisplayManager.class)
                .createVirtualDisplay(
                        "MapLibreSampleVirtualDisplay",
                        surfaceContainer.getWidth(),
                        surfaceContainer.getHeight(),
                        surfaceContainer.getDpi(),
                        surfaceContainer.getSurface(),
                        0
                );
        this.virtualDisplay = virtualDisplay;

        Presentation presentation = new Presentation(carContext, virtualDisplay.getDisplay());
        this.presentation = presentation;
        presentation.setContentView(mapContainer.setupMap());
        presentation.show();
    }

    @Override
    public void onVisibleAreaChanged(Rect visibleArea) {
        if (!visibleArea.equals(lastKnownVisibleArea)) {
            Log.v(LOG_TAG, "onVisibleAreaChanged left(" + visibleArea.left + ") top(" + visibleArea.top
                    + ") right(" + visibleArea.right + ") bottom(" + visibleArea.bottom + ")");
            lastKnownVisibleArea = visibleArea;
        }
    }

    @Override
    public void onStableAreaChanged(Rect stableArea) {
        if (!stableArea.equals(lastKnownStableArea)) {
            Log.v(LOG_TAG, "onStableAreaChanged left(" + stableArea.left + ") top(" + stableArea.top
                    + ") right(" + stableArea.right + ") bottom(" + stableArea.bottom + ")");
            lastKnownStableArea = stableArea;
        }
    }

    @Override
    public void onSurfaceDestroyed(@NonNull SurfaceContainer surfaceContainer) {
        Log.v(LOG_TAG, "Surface destroyed");
        this.surfaceContainer = null;
        uiHandler.removeCallbacksAndMessages(null);
    }

    //@Override
    public void zoomInFromButton() {
        float centerX = surfaceContainer != null ? surfaceContainer.getWidth() / 2f : -1f;
        float centerY = surfaceContainer != null ? surfaceContainer.getHeight() / 2f : -1f;
        onScale(centerX, centerY, CarMapContainer.DOUBLE_CLICK_FACTOR);
    }

    //@Override
    public void zoomOutFromButton() {
        float centerX = surfaceContainer != null ? surfaceContainer.getWidth() / 2f : -1f;
        float centerY = surfaceContainer != null ? surfaceContainer.getHeight() / 2f : -1f;
        onScale(centerX, centerY, -CarMapContainer.DOUBLE_CLICK_FACTOR);
    }

    @Override
    public void onScale(float focusX, float focusY, float scaleFactor) {
        mapContainer.onScale(focusX, focusY, scaleFactor);
    }

    @Override
    public synchronized void onScroll(float distanceX, float distanceY) {
        Log.v(LOG_TAG, "onScroll distanceX(" + distanceX + ") distanceY(" + distanceY + ")");
        mapContainer.scrollBy(distanceX, distanceY);
    }

    @Override
    public void onClick(float x, float y) {
        SurfaceCallback.super.onClick(x, y);
    }

    @Override
    public void onFling(float velocityX, float velocityY) {
        SurfaceCallback.super.onFling(velocityX, velocityY);
        // We don't need to implement onFling since the MapView does this for us
    }
}