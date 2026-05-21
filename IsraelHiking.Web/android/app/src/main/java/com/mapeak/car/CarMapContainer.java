package com.mapeak.car;
import android.animation.Animator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Paint;
import android.graphics.PointF;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.annotation.MainThread;
import androidx.car.app.CarContext;
import org.maplibre.android.MapLibre;
import org.maplibre.android.constants.MapLibreConstants;
import org.maplibre.android.maps.MapLibreMap;
import org.maplibre.android.maps.MapLibreMapOptions;
import org.maplibre.android.maps.MapView;
import org.maplibre.android.maps.Style;

public class CarMapContainer {

    public static final String LOG_TAG = "CarMapContainer";
    public static final float DOUBLE_CLICK_FACTOR = 2.0f;

    private final CarContext carContext;
    private MapView mapViewInstance = null;
    public MapLibreMap mapLibreMapInstance = null;
    private Animator scaleAnimator = null;

    public CarMapContainer(CarContext carContext) {
        this.carContext = carContext;
    }

    public MapView getMapViewInstance() {
        return mapViewInstance;
    }

    public void scrollBy(float x, float y) {
        if (mapLibreMapInstance != null) {
            mapLibreMapInstance.scrollBy(-x, -y, 0);
        }
    }

    private Animator createScaleAnimator(
            double currentZoom,
            double zoomAddition,
            PointF animationFocalPoint
    ) {
        ValueAnimator animator = ValueAnimator.ofFloat(
                (float) currentZoom,
                (float) (currentZoom + zoomAddition)
        );
        animator.setDuration((long) MapLibreConstants.ANIMATION_DURATION);
        animator.setInterpolator(new DecelerateInterpolator());
        animator.addUpdateListener(animation -> {
            if (animationFocalPoint != null && mapLibreMapInstance != null) {
                mapLibreMapInstance.setZoom(
                        (double) (float) animation.getAnimatedValue(),
                        animationFocalPoint,
                        0
                );
            }
        });
        return animator;
    }

    private void doubleClickZoomWithAnimation(PointF zoomFocalPoint, boolean isZoomIn) {
        cancelCurrentAnimator(scaleAnimator);
        if (mapLibreMapInstance != null) {
            double currentZoom = mapLibreMapInstance.getZoom();
            scaleAnimator = createScaleAnimator(
                    currentZoom,
                    isZoomIn ? 1.0 : -1.0,
                    zoomFocalPoint
            );
            scaleAnimator.start();
        }
    }

    private void cancelCurrentAnimator(Animator animator) {
        if (animator != null && animator.isStarted()) {
            animator.cancel();
        }
    }

    public void onScale(float focusX, float focusY, float scaleFactor) {
        if (scaleFactor == DOUBLE_CLICK_FACTOR) {
            doubleClickZoomWithAnimation(new PointF(focusX, focusY), true);
            return;
        }
        if (scaleFactor == -DOUBLE_CLICK_FACTOR) {
            doubleClickZoomWithAnimation(new PointF(focusX, focusY), false);
            return;
        }
        if (mapLibreMapInstance != null) {
            double currentZoomLevel = mapLibreMapInstance.getZoom();
            double zoomAdditional = (Math.log(scaleFactor) / Math.log(Math.PI / 2))
                    * MapLibreConstants.ZOOM_RATE;
            mapLibreMapInstance.setZoom(
                    currentZoomLevel + zoomAdditional,
                    new PointF(focusX, focusY),
                    0
            );
        }
    }

    @MainThread
    public View setupMap() {
        MapLibre.getInstance(carContext);

        MapView mapView = createMapViewInstance();
        mapView.onStart();
        mapView.getMapAsync(map -> {
            mapViewInstance = mapView;
            mapLibreMapInstance = map;
            map.setStyle(new Style.Builder().fromUri("https://demotiles.maplibre.org/style.json"));
        });
        mapViewInstance = mapView;

        TextView attribution = new TextView(carContext);
        attribution.setText("© OpenStreetMap");
        attribution.setTextColor(0x7B996A74);

        FrameLayout frameLayout = new FrameLayout(carContext);
        frameLayout.addView(
                mapView,
                new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                )
        );
        frameLayout.addView(
                attribution,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.BOTTOM | Gravity.END
                )
        );

        return frameLayout;
    }

    @MainThread
    public void cleanUpMap() {
        mapLibreMapInstance = null;

        if (mapViewInstance != null) {
            mapViewInstance.onStop();
            mapViewInstance.onDestroy();
            ((WindowManager) carContext.getSystemService(Context.WINDOW_SERVICE)).removeView(mapViewInstance);
            mapViewInstance = null;
        }
    }

    private MapView createMapViewInstance() {
        MapView mapView = new MapView(
                carContext,
                MapLibreMapOptions.createFromAttributes(carContext)
        );
        mapView.setLayerType(View.LAYER_TYPE_HARDWARE, new Paint());
        return mapView;
    }
}