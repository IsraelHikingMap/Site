package com.mapeak.offline

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.os.SystemClock
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.mapeak.R

/**
 * The one notification of a tile download, with its combined progress. Both the job and the foreground
 * service are required to show one while they run, and tapping it brings the app back.
 */
class TileDownloadNotification(private val context: Context) {
    private val notificationManager = NotificationManagerCompat.from(context)
    private var lastUpdate = 0L

    fun build(progress: Double): Notification {
        ensureChannel()
        val percentage = (progress * 100).toInt().coerceIn(0, 100)
        return NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.bg_notification)
            .setContentTitle(context.getString(R.string.app_name))
            .setContentText("$percentage%")
            .setProgress(100, percentage, false)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setContentIntent(launchIntent())
            .build()
    }

    /** Shows the progress, at most once every UPDATE_INTERVAL_MS since the system throttles faster updates anyway */
    fun update(progress: Double) {
        val now = SystemClock.elapsedRealtime()
        if (now - lastUpdate < UPDATE_INTERVAL_MS) {
            return
        }
        lastUpdate = now
        try {
            notificationManager.notify(NOTIFICATION_ID, build(progress))
        } catch (_: SecurityException) {
            return
        }
    }

    private fun launchIntent(): PendingIntent? {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
        return PendingIntent.getActivity(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    private fun ensureChannel() {
        notificationManager.createNotificationChannel(
            NotificationChannelCompat.Builder(CHANNEL_ID, NotificationManagerCompat.IMPORTANCE_LOW)
                .setName(CHANNEL_NAME)
                .build()
        )
    }

    companion object {
        const val NOTIFICATION_ID = 2026
        private const val CHANNEL_ID = "mapeak-offline-download"
        private const val CHANNEL_NAME = "Offline maps download"
        private const val UPDATE_INTERVAL_MS = 1_000L
    }
}
