package com.mapeak.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.model.Distance;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import com.mapeak.R;

import java.util.Locale;
import java.util.TimeZone;

public class CarMapScreen extends Screen implements CarMessageBus.CarEventListener, DefaultLifecycleObserver {

    private final CarContext carContext;
    private final CarMapRenderer carMapRenderer;

    private Double remainingMeters = null;
    private Long remainingSeconds = null;
    private String units = "metric";

    public CarMapScreen(CarContext carContext, CarMapRenderer carMapRenderer) {
        super(carContext);
        this.carContext = carContext;
        this.carMapRenderer = carMapRenderer;
        getLifecycle().addObserver(this);
    }

    @Override
    public void onCreate(@NonNull LifecycleOwner owner) {
        CarMessageBus.getInstance().registerListener(this);
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        CarMessageBus.getInstance().unregisterListener(this);
    }

    @Override
    public void onCarEvent(CarMessageBus.CarEvent event) {
        if (!CarMessageBus.EVENT_STATISTICS.equals(event.actionId())) {
            return;
        }
        var payload = event.payload();
        if (payload == null) {
            remainingMeters = null;
            remainingSeconds = null;
        } else {
            remainingMeters = payload.optDouble("remainingMeters");
            remainingSeconds = payload.optLong("remainingSeconds");
            units = payload.optString("units", "metric");
        }
        invalidate();
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        NavigationTemplate.Builder templateBuilder = new NavigationTemplate.Builder();
        templateBuilder.setActionStrip(buildActionStrip().build());
        if (carContext.getCarAppApiLevel() >= 2) {
            templateBuilder.setMapActionStrip(buildMapActionStrip(carMapRenderer).build());
        }
        TravelEstimate estimate = buildTravelEstimate();
        if (estimate != null) {
            templateBuilder.setDestinationTravelEstimate(estimate);
        }
        return templateBuilder.build();
    }

    private TravelEstimate buildTravelEstimate() {
        if (remainingMeters == null || remainingSeconds == null) {
            return null;
        }
        boolean isImperial = "imperial".equals(units);
        Distance remainingDistance = isImperial
                ? Distance.create(remainingMeters / 1609.344, Distance.UNIT_MILES)
                : Distance.create(remainingMeters / 1000.0, Distance.UNIT_KILOMETERS);
        DateTimeWithZone arrivalTime = DateTimeWithZone.create(System.currentTimeMillis() + remainingSeconds * 1000,
                TimeZone.getDefault());
        return new TravelEstimate.Builder(remainingDistance, arrivalTime)
                .setRemainingTimeSeconds(remainingSeconds)
                .build();
    }

    private ActionStrip.Builder buildActionStrip() {
        ActionStrip.Builder actionStripBuilder = new ActionStrip.Builder();

        actionStripBuilder.addAction(
                new Action.Builder()
                        .setIcon(
                                new CarIcon.Builder(
                                        IconCompat.createWithResource(
                                                carContext,
                                                R.drawable.ic_menu))
                                        .build())
                        .build());

        return actionStripBuilder;
    }

    private ActionStrip.Builder buildMapActionStrip(CarMapRenderer carMapRenderer) {
        ActionStrip.Builder actionStripBuilder = new ActionStrip.Builder();

        actionStripBuilder.addAction(Action.PAN);

        actionStripBuilder.addAction(
                new Action.Builder()
                        .setIcon(
                                new CarIcon.Builder(
                                        IconCompat.createWithResource(
                                                carContext,
                                                R.drawable.ic_zoom_in))
                                        .build())
                        .setOnClickListener(carMapRenderer::zoomInFromButton)
                        .build());

        actionStripBuilder.addAction(
                new Action.Builder()
                        .setIcon(
                                new CarIcon.Builder(
                                        IconCompat.createWithResource(
                                                carContext,
                                                R.drawable.ic_zoom_out))
                                        .build())
                        .setOnClickListener(carMapRenderer::zoomOutFromButton)
                        .build());

        return actionStripBuilder;
    }
}
