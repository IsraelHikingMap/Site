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
 * Starts, cancels and reports the tile download, whichever of the two ways it runs: a user-initiated data
 * transfer job on Android 14 and above, and a dataSync foreground service below it. There is only ever one
 * download, a new one cancels the one before it.
 */
object TileDownloads {
    const val JOB_ID = 2026

    /**
     * Saves a new download and hands it to the system. Scheduling a user-initiated job is only allowed
     * while the app is visible, so this is called right after the user asked for the download.
     */
    @Synchronized
    fun start(context: Context, job: TileDownloadJob) {
        TileDownloadJobStore.load(context)?.let { cancel(context, it.tileKey) }
        TileDownloadJobStore.save(context, job)
        val failure = launch(context)
        if (failure != null) {
            fail(context, job, failure)
        }
    }

    /**
     * Stops the transfers of a tile, deletes its partial files and marks it cancelled. The files that
     * already completed are kept.
     */
    @Synchronized
    fun cancel(context: Context, tileKey: String) {
        if (TileDownloadJobStore.load(context)?.tileKey != tileKey) {
            return
        }
        TileDownloader.current?.takeIf { it.job.tileKey == tileKey }?.cancel()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            jobScheduler(context).cancel(JOB_ID)
        }
        val job = TileDownloadJobStore.load(context) ?: return
        deletePartialFiles(context, job)
        if (job.state != TileDownloadJob.RUNNING) {
            return
        }
        job.state = TileDownloadJob.CANCELLED
        TileDownloadJobStore.save(context, job)
        TileDownloader.listeners.forEach { it.onTileFinished(job) }
    }

    /**
     * The download of a tile as it stands, null when there is none. A download that is saved as running
     * while nothing runs it, since its process was killed, is completed when all its files are found on
     * disk, and continued otherwise - this is asked when the app is visible, which is when it can be.
     */
    @Synchronized
    fun get(context: Context, tileKey: String): TileDownloadJob? {
        val job = TileDownloadJobStore.load(context) ?: return null
        if (job.tileKey != tileKey) {
            return null
        }
        job.markFilesFoundOnDisk(context)
        if (job.state != TileDownloadJob.RUNNING || isRunning(context)) {
            return job
        }
        if (job.files.all { it.state == TileDownloadFile.COMPLETED }) {
            job.state = TileDownloadJob.COMPLETED
            TileDownloadJobStore.save(context, job)
            return job
        }
        TileDownloadJobStore.save(context, job)
        val failure = launch(context)
        if (failure != null) {
            fail(context, job, failure)
        }
        return job
    }

    private fun isRunning(context: Context): Boolean {
        if (TileDownloader.current != null) {
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
            ContextCompat.startForegroundService(context, Intent(context, TileDownloadForegroundService::class.java))
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
        val jobInfo = JobInfo.Builder(JOB_ID, ComponentName(context, TileDownloadJobService::class.java))
            .setUserInitiated(true)
            .setRequiredNetwork(network)
            .build()
        return if (jobScheduler(context).schedule(jobInfo) == JobScheduler.RESULT_SUCCESS) {
            null
        } else {
            "the job could not be scheduled (RESULT_FAILURE)"
        }
    }

    private fun fail(context: Context, job: TileDownloadJob, reason: String) {
        synchronized(job) {
            job.state = TileDownloadJob.FAILED
            job.files.filter { it.state != TileDownloadFile.COMPLETED }.forEach {
                it.state = TileDownloadFile.FAILED
                it.reason = reason
            }
        }
        TileDownloadJobStore.save(context, job)
        TileDownloader.listeners.forEach { it.onTileFinished(job) }
    }

    private fun deletePartialFiles(context: Context, job: TileDownloadJob) {
        val directory = TileDownloadJob.offlineFilesDirectory(context)
        job.files.forEach { File(directory, "${it.fileName}.part").delete() }
    }

    private fun jobScheduler(context: Context) = context.getSystemService(JobScheduler::class.java)
}
