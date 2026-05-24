package com.mapeak.car;

import android.content.Intent;
import android.location.Location;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.Session;

public class CarSession extends Session {
    public static final String LOG_TAG = "MyCarSession";
    public static boolean isRouteActive = false;

    private CarMapRenderer carMapRenderer;
    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        Log.v(LOG_TAG, "onCreateScreen: " + intent);
        carMapRenderer = new CarMapRenderer(getCarContext(), getLifecycle());
        CarMapScreen carMapScreen = new CarMapScreen(getCarContext(), carMapRenderer);
        getCarContext().getCarService(androidx.car.app.ScreenManager.class).push(carMapScreen);
        return carMapScreen;
    }

    public void setCenter(Location location) {
        carMapRenderer.setCenter(location);
    }
}