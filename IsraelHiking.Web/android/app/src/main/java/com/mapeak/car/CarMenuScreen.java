package com.mapeak.car;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ItemList;
import androidx.car.app.model.ListTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.SectionedItemList;
import androidx.car.app.model.Template;

public class CarMenuScreen extends Screen {

    private final CarContext carContext;

    public CarMenuScreen(CarContext carContext) {
        super(carContext);
        this.carContext = carContext;
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        return new ListTemplate.Builder()
                .setTitle("Menu")
                .setHeaderAction(Action.BACK)
                .addSectionedList(buildNavList())
                .addSectionedList(buildDevList())
                .build();
    }

    private SectionedItemList buildNavList() {
        Row navigationRow = new Row.Builder()
                .setTitle(CarSession.isRouteActive ? "Stop Navigation" : "Start Navigation")
                .setOnClickListener(() -> {
                    CarToast.makeText(
                            carContext,
                            CarSession.isRouteActive ? "Stopping Navigation"
                                    : "Starting Navigation",
                            CarToast.LENGTH_LONG).show();
                    CarSession.isRouteActive = !CarSession.isRouteActive;
                    carContext.getCarService(androidx.car.app.ScreenManager.class).pop();
                })
                .build();

        return SectionedItemList.create(
                new ItemList.Builder()
                        .addItem(navigationRow)
                        .build(),
                "Navigation");
    }

    private SectionedItemList buildDevList() {
        Row testCarToast = new Row.Builder()
                .setTitle("Test CarToast")
                .setOnClickListener(() -> {
                    CarToast.makeText(
                            carContext,
                            "Test CarToast",
                            CarToast.LENGTH_LONG).show();
                    carContext.getCarService(androidx.car.app.ScreenManager.class).pop();
                })
                .build();

        return SectionedItemList.create(
                new ItemList.Builder()
                        .addItem(testCarToast)
                        .build(),
                "Developer tools");
    }
}