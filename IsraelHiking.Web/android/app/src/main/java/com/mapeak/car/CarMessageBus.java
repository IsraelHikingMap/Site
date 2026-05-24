package com.mapeak.car;

import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;

import java.util.ArrayList;
import java.util.List;

public class CarMessageBus {

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    // Type-safe payload structure
    public record CarEvent(String actionId, JSObject payload) {
    }

    // Callback interface for listeners
    public interface CarEventListener {
        void onCarEvent(CarEvent event);
    }

    private static CarMessageBus instance;
    private final List<CarEventListener> listeners = new ArrayList<>();

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
        }
    }

    public synchronized void unregisterListener(CarEventListener listener) {
        listeners.remove(listener);
    }

    public synchronized void emitEvent(CarEvent event) {
        mainHandler.post(() -> {
            synchronized (CarMessageBus.this) {
                for (CarEventListener listener : listeners) {
                    listener.onCarEvent(event);
                }
            }
        });
    }
}
