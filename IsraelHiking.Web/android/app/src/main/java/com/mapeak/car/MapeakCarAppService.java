package com.mapeak.car;

import android.util.Log;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

public class MapeakCarAppService extends CarAppService {
    public static final String LOG_TAG = "MapeakCarAppService";

    @NonNull
    @Override
    public Session onCreateSession() {
        Log.d(LOG_TAG, "Session created");
        return new CarSession();
    }

    @Override
    public void onDestroy() {
        Log.d(LOG_TAG, "onDestroy");
        super.onDestroy();
    }

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // HM TODO: bring this back
        // if (isDebug) {
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        // } else {
        // return new HostValidator.Builder(this)
        // .addAllowedHosts(R.array.car_template_hosts_allowlist)
        // .build();
        // }
    }
}