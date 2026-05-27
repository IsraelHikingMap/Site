package com.mapeak.car;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Location;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;
import com.getcapacitor.JSObject;

public class CarBackgroundLocationBridge implements CarMessageBus.CarEventListener {

    public static final String LOG_TAG = "CarBgLocationBridge";

    private static final String CAPGO_LOCATION_BROADCAST = "com.capgo.capacitor_background_geolocation.broadcast";

    private final Context appContext;
    private final LocalBroadcastManager localBroadcastManager;
    private boolean isRegistered = false;

    private final BroadcastReceiver locationReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Location location = intent.getParcelableExtra("location");
            if (location == null) {
                return;
            }
            emitLocation(location);
            emitCenter(location);
        }
    };

    public CarBackgroundLocationBridge(Context context) {
        this.appContext = context.getApplicationContext();
        this.localBroadcastManager = LocalBroadcastManager.getInstance(appContext);
        CarMessageBus.getInstance().registerListener(this);
    }

    public void destroy() {
        stop();
        CarMessageBus.getInstance().unregisterListener(this);
    }

    @Override
    public void onCarEvent(CarMessageBus.CarEvent event) {
        if (!CarMessageBus.EVENT_BACKGROUND_MODE.equals(event.actionId())) {
            return;
        }
        boolean active = event.payload() != null && event.payload().optBoolean("background", false);
        if (active) {
            start();
        } else {
            stop();
        }
    }

    private synchronized void start() {
        if (isRegistered) {
            return;
        }
        localBroadcastManager.registerReceiver(locationReceiver, new IntentFilter(CAPGO_LOCATION_BROADCAST));
        isRegistered = true;
        Log.i(LOG_TAG, "Background GPS bridge started");
    }

    private synchronized void stop() {
        if (!isRegistered) {
            return;
        }
        try {
            localBroadcastManager.unregisterReceiver(locationReceiver);
        } catch (IllegalArgumentException ignored) {
        }
        isRegistered = false;
        Log.i(LOG_TAG, "Background GPS bridge stopped");
    }

    private void emitLocation(@NonNull Location location) {
        JSObject payload = new JSObject();
        if (location.hasBearing()) {
            payload.put("bearing", location.getBearing());
        }
        payload.put("lat", location.getLatitude());
        payload.put("lng", location.getLongitude());
        payload.put("acc", location.getAccuracy());
        CarMessageBus.getInstance().emitEvent(new CarMessageBus.CarEvent(CarMessageBus.EVENT_LOCATION, payload));
    }

    private void emitCenter(@NonNull Location location) {
        JSObject payload = new JSObject();
        payload.put("lat", location.getLatitude());
        payload.put("lng", location.getLongitude());
        payload.put("bearing", location.hasBearing() ? location.getBearing() : 0);
        payload.put("offsetY", 100);
        CarMessageBus.getInstance().emitEvent(new CarMessageBus.CarEvent(CarMessageBus.EVENT_CENTER, payload));
    }
}
