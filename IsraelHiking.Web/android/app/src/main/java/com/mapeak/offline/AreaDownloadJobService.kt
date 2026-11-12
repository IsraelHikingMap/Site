package com.mapeak.offline

import android.app.job.JobParameters
import android.app.job.JobService
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * Runs the area download as a user-initiated data transfer job, Android 14 and above. The system may
 * stop the job, when the network is gone for example, and runs it again later - the saved job is what
 * lets it continue the files that are still missing.
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class AreaDownloadJobService : JobService() {

    @Volatile
    private var downloader: AreaDownloader? = null

    override fun onStartJob(params: JobParameters): Boolean {
        val notification = AreaDownloadNotification(this)
        setNotification(params, AreaDownloadNotification.NOTIFICATION_ID, notification.build(0.0),
            JOB_END_NOTIFICATION_POLICY_REMOVE)
        val job = AreaDownloadJobStore.load(this)
        if (job == null || job.state != AreaDownloadJob.RUNNING) {
            return false
        }
        val downloader = AreaDownloader(this, job)
        this.downloader = downloader
        Thread {
            val ended = downloader.run { notification.update(it) }
            if (ended && job.state != AreaDownloadJob.CANCELLED) {
                jobFinished(params, false)
            }
        }.start()
        return true
    }

    /**
     * Stops the transfers and asks to be run again unless the download was cancelled. The stop reason is
     * not needed, the job is continued the same way whatever it was.
     */
    override fun onStopJob(params: JobParameters): Boolean {
        val downloader = this.downloader ?: return false
        downloader.stop()
        return downloader.job.state == AreaDownloadJob.RUNNING
    }
}
