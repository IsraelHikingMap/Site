package com.mapeak.offline

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.IBinder
import androidx.core.app.ServiceCompat
import java.util.concurrent.Executors

/**
 * Runs the area download as a dataSync foreground service, Android 13 and below, where there are no
 * user-initiated jobs. Every start runs whatever download is saved as running, one after the other, so
 * that a download that replaced a cancelled one never runs alongside it; the service only stops once the
 * last start it was given is done.
 */
class AreaDownloadForegroundService : Service() {
    private val executor = Executors.newSingleThreadExecutor()
    private val notification by lazy { AreaDownloadNotification(this) }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        ServiceCompat.startForeground(this, AreaDownloadNotification.NOTIFICATION_ID, notification.build(0.0),
            ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        executor.execute {
            val job = AreaDownloadJobStore.load(this)
            if (job != null && job.state == AreaDownloadJob.RUNNING && AreaDownloader.current == null) {
                AreaDownloader(this, job).run { notification.update(it) }
            }
            stopSelf(startId)
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        AreaDownloader.current?.stop()
        executor.shutdown()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }
}
