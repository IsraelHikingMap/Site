package com.mapeak.offline

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import java.io.File

/**
 * Starts, cancels and reports the area download, whichever of the two ways it runs: a user-initiated data
 * transfer job on Android 14 and above, and a dataSync foreground service below it. There is only ever one
 * download, a new one cancels the one before it.
 */
object AreaDownloads {
    const val JOB_ID = 2026

    /**
     * Saves a new download and hands it to the system. Scheduling a user-initiated job is only allowed
     * while the app is visible, so this is called right after the user asked for the download.
     */
    @Synchronized
    fun start(context: Context, job: AreaDownloadJob) {
        AreaDownloadJobStore.load(context)?.let { cancel(context, it.areaId) }
        AreaDownloadJobStore.save(context, job)
        val failure = launch(context)
        if (failure != null) {
            fail(context, job, failure)
        }
    }

    /**
     * Stops the transfers of an area, deletes its partial files and marks it cancelled. The files that
     * already completed are kept.
     */
    @Synchronized
    fun cancel(context: Context, areaId: String) {
        if (AreaDownloadJobStore.load(context)?.areaId != areaId) {
            return
        }
        AreaDownloader.current?.takeIf { it.job.areaId == areaId }?.cancel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            jobScheduler(context).cancel(JOB_ID)
        }
        val job = AreaDownloadJobStore.load(context) ?: return
        deletePartialFiles(context, job)
        if (job.state != AreaDownloadJob.RUNNING) {
            return
        }
        job.state = AreaDownloadJob.CANCELLED
        AreaDownloadJobStore.save(context, job)
        AreaDownloader.listeners.forEach { it.onAreaFinished(job) }
    }

    /**
     * The download of an area as it stands, null when there is none. A download that is saved as running
     * while nothing runs it, since its process was killed, is completed when all its files are found on
     * disk, and continued otherwise - this is asked when the app is visible, which is when it can be.
     */
    @Synchronized
    fun get(context: Context, areaId: String): AreaDownloadJob? {
        val job = AreaDownloadJobStore.load(context) ?: return null
        if (job.areaId != areaId) {
            return null
        }
        job.markFilesFoundOnDisk(context)
        if (job.state != AreaDownloadJob.RUNNING || isRunning(context)) {
            return job
        }
        if (job.files.all { it.state == AreaDownloadFile.COMPLETED }) {
            job.state = AreaDownloadJob.COMPLETED
            AreaDownloadJobStore.save(context, job)
            return job
        }
        AreaDownloadJobStore.save(context, job)
        val failure = launch(context)
        if (failure != null) {
            fail(context, job, failure)
        }
        return job
    }

    private fun isRunning(context: Context): Boolean {
        if (AreaDownloader.current != null) {
            return true
        }
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
            jobScheduler(context).getPendingJob(JOB_ID) != null
    }

    /** Hands the saved download to the system, returns why it could not be when it could not */
    private fun launch(context: Context): String? {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return scheduleJob(context)
        }
        return try {
            ContextCompat.startForegroundService(context, Intent(context, AreaDownloadForegroundService::class.java))
            null
        } catch (ex: Exception) {
            "the foreground service could not be started: ${ex.message}"
        }
    }

    /**
     * Schedules the user-initiated job. The network it requires does not exclude a VPN, which a network
     * request does by default, so that a download is not left waiting forever on a device that uses one.
     */
    @RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
    private fun scheduleJob(context: Context): String? {
        val network = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
            .build()
        val jobInfo = JobInfo.Builder(JOB_ID, ComponentName(context, AreaDownloadJobService::class.java))
            .setUserInitiated(true)
            .setRequiredNetwork(network)
            .build()
        return if (jobScheduler(context).schedule(jobInfo) == JobScheduler.RESULT_SUCCESS) {
            null
        } else {
            "the job could not be scheduled (RESULT_FAILURE)"
        }
    }

    private fun fail(context: Context, job: AreaDownloadJob, reason: String) {
        synchronized(job) {
            job.state = AreaDownloadJob.FAILED
            job.files.filter { it.state != AreaDownloadFile.COMPLETED }.forEach {
                it.state = AreaDownloadFile.FAILED
                it.reason = reason
            }
        }
        AreaDownloadJobStore.save(context, job)
        AreaDownloader.listeners.forEach { it.onAreaFinished(job) }
    }

    private fun deletePartialFiles(context: Context, job: AreaDownloadJob) {
        val directory = AreaDownloadJob.offlineFilesDirectory(context)
        job.files.forEach { File(directory, "${it.fileName}.part").delete() }
    }

    private fun jobScheduler(context: Context) = context.getSystemService(JobScheduler::class.java)
}
