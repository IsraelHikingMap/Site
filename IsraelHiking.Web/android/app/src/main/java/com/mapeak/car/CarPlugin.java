package com.mapeak.car;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Car")
public class CarPlugin extends Plugin implements CarMessageBus.CarEventListener {

    @Override
    public void load() {
        CarMessageBus.getInstance().registerListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        CarMessageBus.getInstance().unregisterListener(this);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void sendMessage(PluginCall call) {
        String type = call.getString("type");
        if (type == null || type.trim().isEmpty()) {
            call.reject("type is required");
            return;
        }

        var payload = call.getObject("payload");
        CarMessageBus.getInstance().emitEvent(new CarMessageBus.CarEvent(type, payload));
        call.resolve();
    }

    @Override
    public void onCarEvent(CarMessageBus.CarEvent event) {
        switch (event.actionId()) {
            case "connected":
            case "moveend":
                if (getBridge() != null) {
                    getBridge().executeOnMainThread(() -> {
                        notifyListeners(event.actionId(), event.payload());
                    });
                }
        }
    }
}
