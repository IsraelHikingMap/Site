package com.mapeak;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
