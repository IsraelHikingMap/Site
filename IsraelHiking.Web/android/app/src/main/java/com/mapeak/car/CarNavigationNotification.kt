package com.mapeak.car

import android.content.Context
import androidx.car.app.notification.CarAppExtender
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/**
 * Ongoing turn-by-turn navigation notification (NF-3). Android for Cars requires apps that show
 * text turn-by-turn directions to also post navigation notifications: these drive the rail widget
 * and keep guidance visible when the app isn't the foreground car screen. The notification is
 * updated as the maneuver/distance changes and cancelled when navigation stops.
 */
class CarNavigationNotification(private val context: Context) {
    private val notificationManager = NotificationManagerCompat.from(context)
    private var channelCreated = false

    fun show(title: String, text: String, smallIconRes: Int) {
        ensureChannel()
        val notification =
                NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(smallIconRes)
                        .setContentTitle(title)
                        .setContentText(text)
                        .setOngoing(true)
                        .setOnlyAlertOnce(true)
                        .setCategory(NotificationCompat.CATEGORY_NAVIGATION)
                        .extend(
                                CarAppExtender.Builder()
                                        .setContentTitle(title)
                                        .setContentText(text)
                                        .setSmallIcon(smallIconRes)
                                        .setImportance(NotificationManagerCompat.IMPORTANCE_LOW)
                                        .build()
                        )
                        .build()
        try {
            notificationManager.notify(NOTIFICATION_ID, notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS not granted — nothing to post, guidance still shows on-screen.
        }
    }

    fun cancel() {
        notificationManager.cancel(NOTIFICATION_ID)
    }

    private fun ensureChannel() {
        if (channelCreated) return
        notificationManager.createNotificationChannel(
                NotificationChannelCompat.Builder(
                                CHANNEL_ID,
                                NotificationManagerCompat.IMPORTANCE_LOW
                        )
                        .setName(CHANNEL_NAME)
                        .build()
        )
        channelCreated = true
    }

    companion object {
        private const val CHANNEL_ID = "mapeak-car-navigation"
        private const val CHANNEL_NAME = "Navigation"
        private const val NOTIFICATION_ID = 2025
    }
}
