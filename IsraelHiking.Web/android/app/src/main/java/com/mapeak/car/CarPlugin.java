package com.mapeak.car;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Car")
public class CarPlugin extends Plugin implements CarMessageBus.CarEventListener {

    private boolean isConnected = false;

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

    @PluginMethod
    public void getConnectionState(PluginCall call) {
        var payload = new JSObject();
        payload.put("connected", isConnected);
        call.resolve(payload);
    }

    @Override
    public void onCarEvent(CarMessageBus.CarEvent event) {
        switch (event.actionId()) {
            case CarMessageBus.EVENT_CONNECTED:
                isConnected = event.payload().getBool("connected");
                raiseEvent(event.actionId(), event.payload());
                break;
            case CarMessageBus.EVENT_LOCATION:
                raiseEvent(event.actionId(), event.payload());
                break;
        }
    }

    private void raiseEvent(String actionId, JSObject payload) {
        if (getBridge() != null) {
            getBridge().executeOnMainThread(() -> {
                notifyListeners(actionId, payload);
            });
        }
    }
}
