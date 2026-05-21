package com.mapeak.car;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

public class MapeakCarAppService extends CarAppService {

    public static final String LOG_TAG = "CarAppService";
    public static boolean isDebug = false;
    public static String appPlatform = "ANDROID_AUTO";

    @NonNull
    @Override
    public Session onCreateSession() {
        return new CarSession();
    }

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        checkManifestForDebug(this);
        // HM TODO: bring this back
        //if (isDebug) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        //} else {
        //    return new HostValidator.Builder(this)
        //            .addAllowedHosts(R.array.car_template_hosts_allowlist)
        //            .build();
        //}
    }

    public static void checkManifestForDebug(Context context) {
        try {
            ApplicationInfo app = context.getPackageManager().getApplicationInfo(
                    context.getPackageName(),
                    PackageManager.GET_META_DATA
            );
            Bundle bundle = app.metaData;
            isDebug = bundle.getBoolean("nl.flitsmeister.maplibrecar.IS_DEBUG", false);
            String platform = bundle.getString("nl.flitsmeister.maplibrecar.APP_PLATFORM");
            appPlatform = platform != null ? platform : "ANDROID_AUTO";
        } catch (Exception e) {
            Log.e(LOG_TAG, "Failed to check manifest (for debug mode and app platform)", e);
        }
    }
}