package com.mapeak.car;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.location.Location;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;
import androidx.localbroadcastmanager.content.LocalBroadcastManager;

public class MapeakCarAppService extends CarAppService {
    public static final String LOG_TAG = "MapeakCarAppService";
    public static CarSession currentSession;
    private final BroadcastReceiver mapUpdateReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            Location location = intent.getParcelableExtra("location");
            Log.d(LOG_TAG, "received position");
            if (location != null && currentSession != null) {
                currentSession.setCenter(location);
            }
        }
    };

    @NonNull
    @Override
    public Session onCreateSession() {
        Log.d(LOG_TAG, "Session created");
        LocalBroadcastManager.getInstance(this).registerReceiver(
                mapUpdateReceiver,
                new IntentFilter("com.capgo.capacitor_background_geolocation.broadcast")
        );
        currentSession = new CarSession();
        return currentSession;
    }

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // HM TODO: bring this back
        //if (isDebug) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        //} else {
        //    return new HostValidator.Builder(this)
        //            .addAllowedHosts(R.array.car_template_hosts_allowlist)
        //            .build();
        //}
    }
}