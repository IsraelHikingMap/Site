package com.mapeak.car;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class CarMessageBus {

    public static final String EVENT_MOVEEND = "moveend";
    public static final String EVENT_CENTER = "center";
    public static final String EVENT_LOCATION = "location";
    public static final String EVENT_ROUTE = "route";
    public static final String EVENT_STYLE = "style";
    public static final String EVENT_CONNECTED = "connected";
    public static final String EVENT_STATISTICS = "statistics";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public record CarEvent(String actionId, JSObject payload) {
    }

    public interface CarEventListener {
        void onCarEvent(CarEvent event);
    }

    private static CarMessageBus instance;
    private final List<CarEventListener> listeners = new ArrayList<>();
    private final Map<String, CarEvent> lastEvents = new HashMap<>();

    private CarMessageBus() {
    }

    public static synchronized CarMessageBus getInstance() {
        if (instance == null) {
            instance = new CarMessageBus();
        }
        return instance;
    }

    public synchronized void registerListener(CarEventListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
            // Replay the last event per actionId so late listeners don't miss state
            for (CarEvent event : lastEvents.values()) {
                synchronized (CarMessageBus.this) {
                    mainHandler.post(() -> listener.onCarEvent(event));
                }
            }
        }
    }

    public synchronized void unregisterListener(CarEventListener listener) {
        listeners.remove(listener);
    }

    public synchronized void emitEvent(CarEvent event) {
        lastEvents.put(event.actionId(), event);
        mainHandler.post(() -> {
            synchronized (CarMessageBus.this) {
                for (CarEventListener listener : listeners) {
                    listener.onCarEvent(event);
                }
            }
        });
    }
}
