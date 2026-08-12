package com.mapeak;

import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.mapeak.car.ReactivePreferencesPlugin;
import com.mapeak.valhalla.ValhallaPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ReactivePreferencesPlugin.class);
        registerPlugin(ValhallaPlugin.class);
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) { // Android 9 and below
            getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING);
        }
    }
}
