package com.mapeak.car;

import android.content.pm.ApplicationInfo;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.util.Log;

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

import android.view.Surface;

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

    // ── Session ──────────────────────────────────────────────────────────────

    static class NavigationSession extends Session {
        @NonNull
        @Override
        public Screen onCreateScreen(@NonNull android.content.Intent intent) {
            Log.d("MapAuto", "onCreateScreen");
            return new NavigationScreen(getCarContext());
        }
    }

    // ── Screen ───────────────────────────────────────────────────────────────

    static class NavigationScreen extends Screen implements SurfaceCallback {

        @Nullable
        private Surface mSurface;
        private int mSurfaceWidth;
        private int mSurfaceHeight;
        private final Paint mTxtPaint = new Paint();

        NavigationScreen(@NonNull CarContext carContext) {
            super(carContext);
            mTxtPaint.setColor(Color.WHITE);
            mTxtPaint.setTextSize(48f);
            mTxtPaint.setAntiAlias(true);
            mTxtPaint.setTextAlign(Paint.Align.CENTER);

            carContext.getCarService(AppManager.class).setSurfaceCallback(this);
            Log.d("MapAuto", "NavigationScreen created, SurfaceCallback registered");
        }

        // SurfaceCallback ─────────────────────────────────────────────────────

        @Override
        public void onSurfaceAvailable(@NonNull SurfaceContainer surfaceContainer) {
            mSurface = surfaceContainer.getSurface();
            mSurfaceWidth = surfaceContainer.getWidth();
            mSurfaceHeight = surfaceContainer.getHeight();
            Log.d("MapAuto", "onSurfaceAvailable: " + mSurfaceWidth + "x" + mSurfaceHeight
                    + " valid=" + (mSurface != null && mSurface.isValid()));
            render("onSurfaceAvailable");
        }

        @Override
        public void onSurfaceDestroyed(@NonNull SurfaceContainer surfaceContainer) {
            Log.d("MapAuto", "onSurfaceDestroyed");
            mSurface = null;
        }

        @Override
        public void onVisibleAreaChanged(@NonNull Rect visibleArea) {
            Log.d("MapAuto", "onVisibleAreaChanged: " + visibleArea);
            render("onVisibleAreaChanged");
        }

        @Override
        public void onStableAreaChanged(@NonNull Rect stableArea) {
            Log.d("MapAuto", "onStableAreaChanged: " + stableArea);
            render("onStableAreaChanged");
        }

        // Template ────────────────────────────────────────────────────────────

        @NonNull
        @Override
        public Template onGetTemplate() {
            Log.d("MapAuto", "onGetTemplate: surface valid="
                    + (mSurface != null && mSurface.isValid()));

            // Trigger a render here too — the surface may already be ready
            // by the time the host calls onGetTemplate on subsequent invalidations.
            render("onGetTemplate");

            ActionStrip mapActionStrip = new ActionStrip.Builder()
                    .addAction(Action.PAN)
                    .build();

            ActionStrip actionStrip = new ActionStrip.Builder()
                    .addAction(Action.APP_ICON)
                    .build();

            return new NavigationTemplate.Builder()
                    .setMapActionStrip(mapActionStrip)
                    .setActionStrip(actionStrip)
                    .build();
        }

        // Render ──────────────────────────────────────────────────────────────

        private void render(@NonNull String from) {
            if (mSurface == null) {
                Log.w("MapAuto", "render(" + from + "): surface is null, skipping");
                return;
            }
            if (!mSurface.isValid()) {
                Log.w("MapAuto", "render(" + from + "): surface not valid, skipping");
                return;
            }
            Canvas canvas = null;
            try {
                canvas = mSurface.lockCanvas(null);
                if (canvas == null) {
                    Log.w("MapAuto", "render(" + from + "): lockCanvas returned null");
                    return;
                }
                Log.d("MapAuto", "render(" + from + "): drawing on "
                        + canvas.getWidth() + "x" + canvas.getHeight());
                canvas.drawColor(Color.rgb(30, 80, 50));
                canvas.drawText(
                        "Hello Android Auto!",
                        canvas.getWidth() / 2f,
                        canvas.getHeight() / 2f,
                        mTxtPaint);
            } catch (Exception e) {
                Log.e("MapAuto", "render(" + from + "): exception: " + e.getMessage(), e);
            } finally {
                if (canvas != null) mSurface.unlockCanvasAndPost(canvas);
            }
        }
    }
}