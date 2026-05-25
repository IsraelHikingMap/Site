package com.mapeak.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.core.graphics.drawable.IconCompat;

import com.mapeak.R;

public class CarMapScreen extends Screen {

    private final CarContext carContext;
    private final CarMapRenderer carMapRenderer;

    public CarMapScreen(CarContext carContext, CarMapRenderer carMapRenderer) {
        super(carContext);
        this.carContext = carContext;
        this.carMapRenderer = carMapRenderer;
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        NavigationTemplate.Builder templateBuilder = new NavigationTemplate.Builder();
        templateBuilder.setActionStrip(buildActionStrip().build());
        if (carContext.getCarAppApiLevel() >= 2) {
            templateBuilder.setMapActionStrip(buildMapActionStrip(carMapRenderer).build());
        }
        return templateBuilder.build();
    }

    private ActionStrip.Builder buildActionStrip() {
        ActionStrip.Builder actionStripBuilder = new ActionStrip.Builder();

        actionStripBuilder.addAction(
                new Action.Builder()
                        .setTitle("Test")
                        .setOnClickListener(() -> CarToast
                                .makeText(carContext, "Test", CarToast.LENGTH_LONG)
                                .show())
                        .build());

        actionStripBuilder.addAction(
                new Action.Builder()
                        .setIcon(
                                new CarIcon.Builder(
                                        IconCompat.createWithResource(
                                                carContext,
                                                R.drawable.ic_menu))
                                        .build())
                        .setOnClickListener(() -> carContext
                                .getCarService(androidx.car.app.ScreenManager.class)
                                .push(new CarMenuScreen(carContext)))
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