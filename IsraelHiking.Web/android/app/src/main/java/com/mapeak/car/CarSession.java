package com.mapeak.car;

import android.content.Intent;
import android.content.res.Configuration;
import android.net.Uri;
import android.util.Log;
import androidx.car.app.CarContext;
import androidx.car.app.CarToast;
import androidx.car.app.Screen;
import androidx.car.app.Session;

public class CarSession extends Session {

    public static final String LOG_TAG = "MyCarSession";
    public static final String INTENT_ACTION_CLICKED_NOTIFICATION = "clicked_notification";
    public static boolean isRouteActive = false;

    private CarMapRenderer carMapRenderer;
    private Configuration carConfiguration = null;

    @Override
    public Screen onCreateScreen(Intent intent) {
        Log.v(LOG_TAG, "onCreateScreen: " + intent);
        carMapRenderer = new CarMapRenderer(getCarContext(), getLifecycle());
        CarMapScreen carMapScreen = new CarMapScreen(getCarContext(), carMapRenderer);
        getCarContext().getCarService(androidx.car.app.ScreenManager.class).push(carMapScreen);
        return carMapScreen;
    }

    @Override
    public void onCarConfigurationChanged(Configuration newConfiguration) {
        Log.v(LOG_TAG, "onCarConfigurationChanged: old: " + carConfiguration + ", new: " + newConfiguration);
        carConfiguration = newConfiguration;
    }

    @Override
    public void onNewIntent(Intent intent) {
        Log.v(LOG_TAG, "onNewIntent: " + intent);
        super.onNewIntent(intent);
        String action = intent.getAction();
        if (action == null) return;

        if (action.equals(CarContext.ACTION_NAVIGATE)) {
            navigateFromIntent(intent);
        } else if (action.equals(INTENT_ACTION_CLICKED_NOTIFICATION)) {
            clickedNotification(intent);
        }
    }

    private void navigateFromIntent(Intent intent) {
        Uri uri = intent.getData();
        if (uri == null) return;
        String query = uri.getQuery();
        if (query == null) return;
        if (!"geo".equals(uri.getScheme())) return;
        CarToast.makeText(getCarContext(), "Navigating to " + query, CarToast.LENGTH_LONG).show();
    }

    private void clickedNotification(Intent intent) {
        CarToast.makeText(getCarContext(), "Clicked notification to " + intent, CarToast.LENGTH_LONG).show();
    }
}