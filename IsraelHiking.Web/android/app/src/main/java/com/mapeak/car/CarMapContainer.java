package com.mapeak.car;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Paint;
import android.graphics.PointF;
import android.location.Location;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.annotation.MainThread;
import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import com.getcapacitor.JSObject;
import org.maplibre.android.MapLibre;
import org.maplibre.android.camera.CameraPosition;
import org.maplibre.android.camera.CameraUpdateFactory;
import org.maplibre.android.constants.MapLibreConstants;
import org.maplibre.android.geometry.LatLng;
import org.maplibre.android.maps.MapLibreMap;
import org.maplibre.android.maps.MapLibreMapOptions;
import org.maplibre.android.maps.MapView;
import org.maplibre.android.maps.Style;
import org.maplibre.android.module.http.HttpRequestUtil;
import org.maplibre.android.style.expressions.Expression;
import org.maplibre.android.style.layers.CircleLayer;
import org.maplibre.android.style.layers.FillLayer;
import org.maplibre.android.style.layers.LineLayer;
import org.maplibre.android.style.layers.Property;
import org.maplibre.android.style.layers.PropertyFactory;
import org.maplibre.android.style.layers.SymbolLayer;
import org.maplibre.android.style.sources.GeoJsonSource;
import org.maplibre.geojson.Feature;
import org.maplibre.geojson.FeatureCollection;
import org.maplibre.geojson.LineString;
import org.maplibre.geojson.Point;
import org.maplibre.geojson.Polygon;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import okhttp3.OkHttpClient;

public class CarMapContainer {
    private static final String LOCATION_SOURCE_ID = "location-source";
    private static final String LOCATION_ICON_LAYER_ID = "location-icon-layer"; // equivalent to resources.locationIcon
    private static final String LOCATION_CIRCLE_LAYER_ID = "location-accuracy-circle-layer";
    private static final String LOCATION_CIRCLE_STROKE_LAYER_ID = "location-accuracy-circle-stroke-layer";
    private static final String ROUTE_SOURCE_ID = "planned-route-source";
    private static final String ROUTE_LAYER_ID = "planned-route-layer";
    private static final String ROUTE_POINTS_LAYER_ID = "planned-route-points-layer";
    private static final String LOCATION_ICON_IMAGE = "gps-arrow";
    private static final int CIRCLE_STEPS = 64;
    public static final float DOUBLE_CLICK_FACTOR = 2.0f;
    private final CarContext carContext;
    private MapView mapViewInstance = null;
    public MapLibreMap mapLibreMapInstance = null;
    private Animator scaleAnimator = null;

    public CarMapContainer(CarContext carContext) {
        this.carContext = carContext;
    }

    public void scrollBy(float x, float y) {
        if (mapLibreMapInstance == null) {
            return;
        }
        mapLibreMapInstance.scrollBy(-x, -y, 0);
        raiseMoveEnd();
    }

    public void setGpsLocation(Location location) {
        if (mapLibreMapInstance == null) {
            return;
        }
        mapLibreMapInstance.getStyle(style -> {
            Feature pointFeature = Feature.fromGeometry(
                    Point.fromLngLat(location.getLongitude(), location.getLatitude()));
            if (location.hasBearing()) {
                pointFeature.properties().addProperty("heading", location.getBearing());
            }

            Feature circleFeature = Feature.fromGeometry(
                    createGeoJsonCircle(location.getLongitude(), location.getLatitude(), location.getAccuracy()));

            FeatureCollection featureCollection = FeatureCollection.fromFeatures(
                    new Feature[] { circleFeature, pointFeature });

            // Add or update the source
            GeoJsonSource existingSource = (GeoJsonSource) style.getSource(LOCATION_SOURCE_ID);

            if (existingSource != null) {
                existingSource.setGeoJson(featureCollection);
            } else {
                GeoJsonSource locationSource = new GeoJsonSource(LOCATION_SOURCE_ID, featureCollection);
                style.addSource(locationSource);
                addLocationLayers(style);
            }
        });
    }

    public void removeGPSLocation() {
        if (mapLibreMapInstance == null) {
            return;
        }
        mapLibreMapInstance.getStyle(style -> {
            style.removeLayer(LOCATION_ICON_LAYER_ID);
            style.removeLayer(LOCATION_CIRCLE_LAYER_ID);
            style.removeLayer(LOCATION_CIRCLE_STROKE_LAYER_ID);
            style.removeSource(LOCATION_SOURCE_ID);
        });
    }

    public void setCenterAndZoom(double lat, double lng, Double zoom, double bearing, int offsetY) {
        if (mapLibreMapInstance == null) {
            return;
        }

        double effectiveZoom = zoom != null ? zoom : mapLibreMapInstance.getCameraPosition().zoom;
        var center = mapLibreMapInstance.getCameraPosition().target;
        if (Math.abs(center.getLatitude() - lat) < 1e-6 &&
                Math.abs(center.getLongitude() - lng) < 1e-6 &&
                Math.abs(mapLibreMapInstance.getCameraPosition().zoom - effectiveZoom) < 1e-3) {
            return;
        }
        var latLng = new LatLng(lat, lng);
        var point = mapLibreMapInstance.getProjection().toScreenLocation(latLng);
        point.y -= offsetY;
        latLng = mapLibreMapInstance.getProjection().fromScreenLocation(point);
        CameraPosition.Builder positionBuilder = new CameraPosition.Builder()
                .target(latLng)
                .zoom(effectiveZoom)
                .bearing(bearing);
        mapLibreMapInstance.easeCamera(CameraUpdateFactory.newCameraPosition(positionBuilder.build()), 250);
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
    private Polygon createGeoJsonCircle(double lng, double lat, double radiusMeters) {
        List<Point> points = new ArrayList<>(CIRCLE_STEPS + 1);

        // Earth's radius in meters (WGS-84 mean)
        final double earthRadius = 6_378_137.0;

        double latRad = Math.toRadians(lat);
        double lngRad = Math.toRadians(lng);
        // Angular radius on the sphere
        double angularRadius = radiusMeters / earthRadius;

        for (int i = 0; i < CIRCLE_STEPS; i++) {
            // Bearing for this step, evenly distributed around 360°
            double bearing = Math.toRadians((360.0 / CIRCLE_STEPS) * i);

            // Spherical destination formula (same as turf.destination)
            double pointLat = Math.asin(
                    Math.sin(latRad) * Math.cos(angularRadius)
                            + Math.cos(latRad) * Math.sin(angularRadius) * Math.cos(bearing));
            double pointLng = lngRad + Math.atan2(
                    Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(latRad),
                    Math.cos(angularRadius) - Math.sin(latRad) * Math.sin(pointLat));

            points.add(Point.fromLngLat(Math.toDegrees(pointLng), Math.toDegrees(pointLat)));
        }

        // Close the ring
        points.add(points.get(0));

        return Polygon.fromLngLats(Collections.singletonList(points));
    }

    private void addLocationLayers(@NonNull Style style) {
        Expression isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"));
        Expression isPolygon = Expression.eq(Expression.geometryType(), Expression.literal("Polygon"));

        SymbolLayer gpsIconLayer = new SymbolLayer(LOCATION_ICON_LAYER_ID, LOCATION_SOURCE_ID);
        gpsIconLayer.setFilter(isPoint);
        gpsIconLayer.setProperties(
                PropertyFactory.iconImage(LOCATION_ICON_IMAGE),
                PropertyFactory.iconSize(1.0f),
                PropertyFactory.iconRotate(Expression.get("heading")),
                PropertyFactory.iconRotationAlignment(Property.ICON_ROTATION_ALIGNMENT_MAP),
                PropertyFactory.iconIgnorePlacement(true),
                PropertyFactory.iconAllowOverlap(true));
        style.addLayer(gpsIconLayer);

        FillLayer accuracyCircleLayer = new FillLayer(LOCATION_CIRCLE_LAYER_ID, LOCATION_SOURCE_ID);
        accuracyCircleLayer.setFilter(isPolygon);
        accuracyCircleLayer.setProperties(
                PropertyFactory.fillColor("#136AEC"),
                PropertyFactory.fillOutlineColor("#136AEC"),
                PropertyFactory.fillOpacity(0.2f));
        style.addLayer(accuracyCircleLayer);

        LineLayer accuracyCircleStrokeLayer = new LineLayer(LOCATION_CIRCLE_STROKE_LAYER_ID, LOCATION_SOURCE_ID);
        accuracyCircleStrokeLayer.setFilter(isPolygon);
        accuracyCircleStrokeLayer.setProperties(
                PropertyFactory.lineColor("#136AEC"),
                PropertyFactory.lineWidth(2f));
        style.addLayer(accuracyCircleStrokeLayer);
    }

    public void setRoute(ArrayList<LatLng> points, double weight, String color, double opacity) {
        if (mapLibreMapInstance == null) {
            return;
        }
        mapLibreMapInstance.getStyle(style -> {
            List<Point> geoJsonPoints = new ArrayList<>();
            for (LatLng latLng : points) {
                geoJsonPoints.add(Point.fromLngLat(latLng.getLongitude(), latLng.getLatitude()));
            }

            FeatureCollection featureCollection;
            if (points.isEmpty()) {
                featureCollection = FeatureCollection.fromFeatures(new Feature[0]);
            } else {
                LineString lineString = LineString.fromLngLats(geoJsonPoints);
                Feature routeFeature = Feature.fromGeometry(lineString);
                routeFeature.properties().addProperty("weight", weight);
                routeFeature.properties().addProperty("color", color);
                routeFeature.properties().addProperty("opacity", opacity);

                Feature startPointFeature = Feature
                        .fromGeometry(Point.fromLngLat(points.get(0).getLongitude(), points.get(0).getLatitude()));
                startPointFeature.properties().addProperty("color", "#43a047");
                startPointFeature.properties().addProperty("strokeColor", "white");

                Feature endPointFeature = Feature.fromGeometry(Point.fromLngLat(
                        points.get(points.size() - 1).getLongitude(),
                        points.get(points.size() - 1).getLatitude()));
                endPointFeature.properties().addProperty("color", "red");
                endPointFeature.properties().addProperty("strokeColor", "white");

                featureCollection = FeatureCollection
                        .fromFeatures(new Feature[] { routeFeature, startPointFeature, endPointFeature });
            }

            GeoJsonSource routeSource = style.getSourceAs(ROUTE_SOURCE_ID);

            if (routeSource != null) {
                routeSource.setGeoJson(featureCollection);
                return;
            }

            GeoJsonSource newSource = new GeoJsonSource(ROUTE_SOURCE_ID, featureCollection);
            style.addSource(newSource);
            addRouteLayers(style);
        });
    }

    private void addRouteLayers(@NonNull Style style) {
        Expression isLineString = Expression.eq(Expression.geometryType(), Expression.literal("LineString"));
        Expression isPoint = Expression.eq(Expression.geometryType(), Expression.literal("Point"));

        LineLayer routeLayer = new LineLayer(ROUTE_LAYER_ID, ROUTE_SOURCE_ID);
        routeLayer.setFilter(isLineString);
        routeLayer.setProperties(
                PropertyFactory.lineColor(Expression.get("color")),
                PropertyFactory.lineWidth(Expression.get("weight")),
                PropertyFactory.lineOpacity(Expression.get("opacity")),
                PropertyFactory.lineCap(Property.LINE_CAP_BUTT),
                PropertyFactory.lineJoin(Property.LINE_JOIN_BEVEL));
        style.addLayer(routeLayer);

        CircleLayer routePointsLayer = new CircleLayer(ROUTE_POINTS_LAYER_ID, ROUTE_SOURCE_ID);
        routePointsLayer.setFilter(isPoint);
        routePointsLayer.setProperties(
                PropertyFactory.circleColor(Expression.get("color")),
                PropertyFactory.circleRadius(7f),
                PropertyFactory.circleStrokeColor(Expression.get("strokeColor")),
                PropertyFactory.circleStrokeWidth(3f));
        style.addLayer(routePointsLayer);
    }

    private Animator createScaleAnimator(
            double currentZoom,
            double zoomAddition,
            PointF animationFocalPoint) {
        ValueAnimator animator = ValueAnimator.ofFloat(
                (float) currentZoom,
                (float) (currentZoom + zoomAddition));
        animator.setDuration(MapLibreConstants.ANIMATION_DURATION);
        animator.setInterpolator(new DecelerateInterpolator());
        animator.addUpdateListener(animation -> {
            if (animationFocalPoint != null && mapLibreMapInstance != null) {
                mapLibreMapInstance.setZoom(
                        (double) (float) animation.getAnimatedValue(),
                        animationFocalPoint,
                        0);
            }
        });
        animator.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator a) {
                raiseMoveEnd();
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
                    zoomFocalPoint);
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
                    0);
            raiseMoveEnd();
        }
    }

    @MainThread
    public View setupMap(float pixelRatio) {
        MapLibre.getInstance(carContext);
        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(new SliceProtocolInterceptor(new PmTilesService(carContext)))
                .build();
        HttpRequestUtil.setOkHttpClient(client);

        MapView mapView = createMapViewInstance(pixelRatio);
        mapView.onStart();
        mapView.getMapAsync(map -> {
            mapViewInstance = mapView;
            mapLibreMapInstance = map;
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
                        ViewGroup.LayoutParams.MATCH_PARENT));
        frameLayout.addView(
                attribution,
                new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        FrameLayout.LayoutParams.WRAP_CONTENT,
                        Gravity.BOTTOM | Gravity.END));

        return frameLayout;
    }

    @MainThread
    public void cleanUpMap() {
        if (mapViewInstance == null) {
            return;
        }

        mapLibreMapInstance = null;

        mapViewInstance.onPause();
        mapViewInstance.onStop();

        try {
            ((WindowManager) carContext.getSystemService(Context.WINDOW_SERVICE)).removeView(mapViewInstance);
        } catch (IllegalArgumentException ignored) {
        }

        mapViewInstance.onDestroy();
        mapViewInstance = null;
    }

    private MapView createMapViewInstance(float pixelRatio) {
        MapLibreMapOptions options = MapLibreMapOptions.createFromAttributes(carContext);
        options.pixelRatio(pixelRatio);
        MapView mapView = new MapView(carContext, options);
        mapView.setLayerType(View.LAYER_TYPE_HARDWARE, new Paint());
        return mapView;
    }

    private void raiseMoveEnd() {
        if (mapLibreMapInstance == null) {
            return;
        }

        var payload = new JSObject();
        LatLng mapCenter = mapLibreMapInstance.getCameraPosition().target;
        payload.put("zoom", mapLibreMapInstance.getCameraPosition().zoom);
        payload.put("lng", mapCenter.getLongitude());
        payload.put("lat", mapCenter.getLatitude());

        CarMessageBus.getInstance().emitEvent(new CarMessageBus.CarEvent(CarMessageBus.EVENT_MOVEEND, payload));
    }

    public void setStyle(JSObject styleData) {
        if (mapLibreMapInstance == null) {
            return;
        }

        mapLibreMapInstance.setStyle(new Style.Builder().fromJson(styleData.toString()));
        mapLibreMapInstance.getStyle(style -> {
            try {
                InputStream inputStream = carContext.getAssets().open("public/content/gps-arrow.png");
                Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                style.addImage(LOCATION_ICON_IMAGE, bitmap);
                inputStream.close();
            } catch (IOException ignored) {
            }
        });
    }
}