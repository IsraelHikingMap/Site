package com.mapeak.car;

import android.content.pm.ApplicationInfo;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.util.Log;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.car.app.AppManager;
import androidx.car.app.CarAppService;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.Session;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.validation.HostValidator;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

public class NavigationCarApp extends CarAppService {
    private static final String TAG = "MapAuto";

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        }
        return new HostValidator.Builder(getApplicationContext())
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build();
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new NavigationSession();
    }

    static class NavigationSession extends Session {
        @NonNull
        @Override
        public Screen onCreateScreen(@NonNull android.content.Intent intent) {
            return new NavigationScreen(getCarContext());
        }
    }

    static class NavigationScreen extends Screen implements SurfaceCallback {
        @Nullable
        private Surface mSurface;
        private final Paint mTxtPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        NavigationScreen(@NonNull CarContext carContext) {
            super(carContext);
            mTxtPaint.setColor(Color.WHITE);
            mTxtPaint.setTextSize(48f);
            mTxtPaint.setTextAlign(Paint.Align.CENTER);

            getLifecycle().addObserver(new DefaultLifecycleObserver() {
                @Override
                public void onResume(@NonNull LifecycleOwner owner) {
                    getCarContext().getCarService(AppManager.class).setSurfaceCallback(NavigationScreen.this);
                    invalidate();
                }

                @Override
                public void onPause(@NonNull LifecycleOwner owner) {
                    getCarContext().getCarService(AppManager.class).setSurfaceCallback(null);
                    mSurface = null;
                }

                @Override
                public void onDestroy(@NonNull LifecycleOwner owner) {
                    getCarContext().getCarService(AppManager.class).setSurfaceCallback(null);
                    mSurface = null;
                }
            });
        }

        @Override
        public void onSurfaceAvailable(@NonNull SurfaceContainer surfaceContainer) {
            mSurface = surfaceContainer.getSurface();
            Log.d(TAG, "onSurfaceAvailable: " + surfaceContainer.getWidth() + "x" + surfaceContainer.getHeight()
                    + " valid=" + (mSurface != null && mSurface.isValid()));
            drawOnce("onSurfaceAvailable");
        }

        @Override
        public void onSurfaceDestroyed(@NonNull SurfaceContainer surfaceContainer) {
            Log.d(TAG, "onSurfaceDestroyed");
            mSurface = null;
        }

        @Override
        public void onVisibleAreaChanged(@NonNull Rect visibleArea) {
            Log.d(TAG, "onVisibleAreaChanged: " + visibleArea);
        }

        @Override
        public void onStableAreaChanged(@NonNull Rect stableArea) {
            Log.d(TAG, "onStableAreaChanged: " + stableArea);
        }

        @NonNull
        @Override
        public Template onGetTemplate() {
            return new NavigationTemplate.Builder()
                    .setMapActionStrip(new ActionStrip.Builder()
                            .addAction(Action.PAN)
                            .build())
                    .setActionStrip(new ActionStrip.Builder()
                            .addAction(Action.APP_ICON)
                            .build())
                    .build();
        }

        private void drawOnce(@NonNull String from) {
            if (mSurface == null || !mSurface.isValid()) {
                Log.d(TAG, "drawOnce(" + from + "): surface not ready");
                return;
            }

            Canvas canvas = null;
            try {
                canvas = mSurface.lockCanvas(null);
                if (canvas == null) {
                    Log.d(TAG, "drawOnce(" + from + "): lockCanvas returned null");
                    return;
                }

                canvas.drawColor(Color.rgb(30, 80, 50));
                canvas.drawText("Hello Android Auto!",
                        canvas.getWidth() / 2f,
                        canvas.getHeight() / 2f,
                        mTxtPaint);
            } catch (Throwable t) {
                Log.e(TAG, "drawOnce(" + from + "): failed", t);
            } finally {
                if (canvas != null) {
                    mSurface.unlockCanvasAndPost(canvas);
                }
            }
        }
    }
}