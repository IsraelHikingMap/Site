package com.mapeak.car;

import android.animation.Animator;
import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
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
import org.maplibre.android.style.expressions.Expression;
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

public class CarMapContainer {
    private static final String LOCATION_SOURCE_ID = "location-source";
    private static final String LOCATION_ICON_LAYER_ID = "location-icon-layer"; // equivalent to resources.locationIcon
    private static final String LOCATION_CIRCLE_LAYER_ID = "location-accuracy-circle-layer";
    private static final String LOCATION_CIRCLE_STROKE_LAYER_ID = "location-accuracy-circle-stroke-layer";
    private static final String ROUTE_SOURCE_ID = "planned-route-source";
    private static final String ROUTE_LAYER_ID = "planned-route-layer";
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
        if (mapLibreMapInstance != null) {
            mapLibreMapInstance.scrollBy(-x, -y, 0);
        }
    }

    public void setGpsLocation(Location location, double zoom) {
        if (mapLibreMapInstance == null || mapLibreMapInstance.getStyle() == null) {
            return;
        }
        var style = mapLibreMapInstance.getStyle();
        var targetLocation = new LatLng(location.getLatitude(), location.getLongitude());

        // Build a FeatureCollection with both the point and the accuracy polygon
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

        var positionBuilder = new CameraPosition.Builder()
                .target(targetLocation)
                .zoom(zoom);
        if (location.hasBearing()) {
            positionBuilder.bearing(location.getBearing());
        }
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

    public void setRoute(ArrayList<LatLng> points) {
        if (mapLibreMapInstance == null || mapLibreMapInstance.getStyle() == null) {
            return;
        }
        List<Point> geoJsonPoints = new ArrayList<>();
        for (LatLng latLng : points) {
            geoJsonPoints.add(Point.fromLngLat(latLng.getLongitude(), latLng.getLatitude()));
        }

        LineString lineString = LineString.fromLngLats(geoJsonPoints);
        Feature routeFeature = Feature.fromGeometry(lineString);

        var style = mapLibreMapInstance.getStyle();
        GeoJsonSource routeSource = style.getSourceAs(ROUTE_SOURCE_ID);

        if (routeSource != null) {
            routeSource.setGeoJson(routeFeature);
            return;
        }

        GeoJsonSource newSource = new GeoJsonSource(ROUTE_SOURCE_ID, routeFeature);
        style.addSource(newSource);

        LineLayer routeLayer = new LineLayer(ROUTE_LAYER_ID, ROUTE_SOURCE_ID)
                .withProperties(
                        PropertyFactory.lineColor(Color.parseColor("#007AFF")),
                        PropertyFactory.lineWidth(5f),
                        PropertyFactory.lineJoin("round"),
                        PropertyFactory.lineCap("round"));

        style.addLayer(routeLayer);
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
            map.setStyle(new Style.Builder().fromUri(
                    "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json"));
            mapLibreMapInstance.getStyle(style -> {
                try {
                    InputStream inputStream = carContext.getAssets().open("public/content/gps-arrow.png");
                    Bitmap bitmap = BitmapFactory.decodeStream(inputStream);
                    style.addImage(LOCATION_ICON_IMAGE, bitmap);
                    inputStream.close();
                } catch (IOException ignored) {
                }
            });
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
                MapLibreMapOptions.createFromAttributes(carContext));
        mapView.setLayerType(View.LAYER_TYPE_HARDWARE, new Paint());
        return mapView;
    }

    public void raiseMoveEnd() {
        if (mapLibreMapInstance == null) {
            return;
        }

        var zoom = mapLibreMapInstance.getZoom();
        LatLng mapCenter = mapLibreMapInstance.getCameraPosition().target;

        var payload = new JSObject();
        payload.put("zoom", zoom);
        payload.put("lng", mapCenter.getLongitude());
        payload.put("lat", mapCenter.getLatitude());

        CarMessageBus.getInstance().emitEvent(new CarMessageBus.CarEvent("moveend", payload));
    }
}