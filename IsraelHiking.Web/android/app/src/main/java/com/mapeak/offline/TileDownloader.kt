package com.mapeak.offline

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.SystemClock
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * Downloads the files of a tile job with OkHttp for whichever of the job service or the foreground
 * service runs it. The files are started in the order of the job by a fixed pool of its concurrency,
 * since the server lists the files that take it longest first.
 * The client and the retry delay are only given by tests, which answer the requests themselves.
 */
class TileDownloader(
    private val context: Context,
    val job: TileDownloadJob,
    private val client: OkHttpClient = sharedClient,
    private val retryDelayMs: Long = RETRY_DELAY_MS
) {

    /** What a download reports, see TileDownloader.listeners */
    interface Listener {
        fun onFileProgress(tileKey: String, fileName: String, fraction: Double)
        fun onFileCompleted(tileKey: String, fileName: String)
        fun onTileFinished(job: TileDownloadJob)
    }

    /** Why a single attempt to download a file failed, and whether trying it again could help */
    private class Failure(val reason: String, val retryable: Boolean, val statusCode: Int? = null)

    private val calls: MutableSet<Call> = ConcurrentHashMap.newKeySet()
    private val fractions = ConcurrentHashMap<String, Double>()
    private val interrupted = CountDownLatch(1)
    private val ended = CountDownLatch(1)

    @Volatile
    private var cancelled = false

    @Volatile
    private var stopped = false

    /** The reason the server did not accept the token, which leaves no point in asking it for any other file */
    @Volatile
    private var rejection: String? = null

    /** How much of the tile was downloaded, from 0 to 1, where every one of its files weighs the same */
    val progress: Double
        get() = if (job.files.isEmpty()) 1.0 else job.files.sumOf { fractions[it.fileName] ?: 0.0 } / job.files.size

    /**
     * Downloads the files that are still missing, on the calling thread. Returns false when the download
     * was stopped before it ended, in which case it is left running in the store to be continued later.
     */
    fun run(onProgress: (Double) -> Unit): Boolean {
        current = this
        try {
            val queue = prepareQueue()
            TileDownloadJobStore.save(context, job)
            val pool = Executors.newFixedThreadPool(job.concurrency.coerceAtLeast(1))
            repeat(job.concurrency.coerceAtLeast(1)) {
                pool.execute {
                    while (!isInterrupted()) {
                        val file = queue.poll() ?: break
                        download(file, onProgress)
                    }
                }
            }
            pool.shutdown()
            pool.awaitTermination(Long.MAX_VALUE, TimeUnit.DAYS)
            if (stopped && !cancelled) {
                TileDownloadJobStore.save(context, job)
                return false
            }
            finish()
            return true
        } finally {
            if (current === this) {
                current = null
            }
            ended.countDown()
        }
    }

    /**
     * Marks the files that are already whole as completed and queues the rest in the order of the job. A
     * file that failed in a run that was stopped is tried again.
     */
    private fun prepareQueue(): ConcurrentLinkedQueue<TileDownloadFile> = synchronized(job) {
        job.markFilesFoundOnDisk(context)
        val queue = ConcurrentLinkedQueue<TileDownloadFile>()
        for (file in job.files) {
            if (file.state == TileDownloadFile.COMPLETED) {
                fractions[file.fileName] = 1.0
                continue
            }
            file.state = TileDownloadFile.PENDING
            file.reason = null
            queue.add(file)
        }
        queue
    }

    /** Stops the transfers and ends the job as cancelled, waiting a little for them to unwind */
    fun cancel() {
        cancelled = true
        interrupt()
        ended.await(CANCEL_WAIT_SECONDS, TimeUnit.SECONDS)
    }

    /** Stops the transfers without ending the job, so that the files that are still missing are continued later */
    fun stop() {
        stopped = true
        interrupt()
    }

    private fun interrupt() {
        interrupted.countDown()
        calls.forEach { it.cancel() }
    }

    private fun isInterrupted() = cancelled || stopped || rejection != null

    /**
     * Downloads a file, trying it again on a network error up to MAX_RETRIES times. A file that was
     * interrupted is left as it is, it is the job that decides what that means.
     */
    private fun download(file: TileDownloadFile, onProgress: (Double) -> Unit) {
        var retries = 0
        while (!isInterrupted()) {
            val failure = attemptDownload(file, onProgress) ?: return completeFile(file, onProgress)
            if (isInterrupted()) {
                return
            }
            if (failure.statusCode == 401 || failure.statusCode == 403) {
                failFile(file, failure.reason)
                rejection = failure.reason
                interrupt()
                return
            }
            if (!failure.retryable || retries >= MAX_RETRIES) {
                return failFile(file, failure.reason)
            }
            retries++
            awaitRetry(retries)
        }
    }

    /**
     * Streams a file into a partial file and gives it its name once all of it arrived. A partial file is
     * never continued - the server does not serve byte ranges - so it is deleted whenever the attempt fails.
     * Returns null when the file was downloaded.
     */
    private fun attemptDownload(file: TileDownloadFile, onProgress: (Double) -> Unit): Failure? {
        val directory = TileDownloadJob.offlineFilesDirectory(context)
        directory.mkdirs()
        val partialFile = File(directory, "${file.fileName}.part")
        val request = Request.Builder().url(file.url).apply {
            job.headers.forEach { (name, value) -> header(name, value) }
        }.build()
        val call = client.newCall(request)
        calls.add(call)
        if (isInterrupted()) {
            call.cancel()
        }
        try {
            call.execute().use { response ->
                if (!response.isSuccessful) {
                    return Failure("HTTP ${response.code}", false, response.code)
                }
                val body = response.body
                val contentLength = body.contentLength()
                var received = 0L
                var lastReported = 0L
                body.byteStream().use { input ->
                    FileOutputStream(partialFile).use { output ->
                        val buffer = ByteArray(BUFFER_SIZE)
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) {
                                break
                            }
                            output.write(buffer, 0, read)
                            received += read
                            val now = SystemClock.elapsedRealtime()
                            if (now - lastReported >= PROGRESS_INTERVAL_MS) {
                                lastReported = now
                                reportProgress(file, if (contentLength > 0) received.toDouble() / contentLength else 0.0, onProgress)
                            }
                        }
                    }
                }
                if (contentLength >= 0 && received != contentLength) {
                    return Failure("network error: received $received of $contentLength bytes", true)
                }
                val targetFile = File(directory, file.fileName)
                targetFile.delete()
                if (!partialFile.renameTo(targetFile)) {
                    return Failure("disk error: could not rename ${partialFile.name}", false)
                }
                return null
            }
        } catch (ex: IOException) {
            return failureOf(ex)
        } finally {
            calls.remove(call)
            partialFile.delete()
        }
    }

    /** The reason an attempt failed on an exception, a full disk is the one failure trying again can not fix */
    private fun failureOf(ex: IOException): Failure {
        val message = ex.message ?: ex.javaClass.simpleName
        return when {
            message.contains("ENOSPC") -> Failure("disk full: $message", false)
            ex is InterruptedIOException && message.contains("timeout", ignoreCase = true) -> Failure("timeout: $message", true)
            else -> Failure("network error: $message", true)
        }
    }

    /**
     * Waits before trying a file again, longer with every retry, and then for a network to try it on - a
     * network that dropped would otherwise use up the retries within seconds.
     */
    private fun awaitRetry(retry: Int) {
        if (interrupted.await(retryDelayMs * retry, TimeUnit.MILLISECONDS)) {
            return
        }
        val giveUpAt = SystemClock.elapsedRealtime() + NETWORK_WAIT_MS
        while (!hasNetwork() && SystemClock.elapsedRealtime() < giveUpAt) {
            if (interrupted.await(NETWORK_POLL_MS, TimeUnit.MILLISECONDS)) {
                return
            }
        }
    }

    private fun hasNetwork(): Boolean {
        val connectivityManager = context.getSystemService(ConnectivityManager::class.java) ?: return true
        val network = connectivityManager.activeNetwork ?: return false
        return connectivityManager.getNetworkCapabilities(network)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    private fun reportProgress(file: TileDownloadFile, fraction: Double, onProgress: (Double) -> Unit) {
        fractions[file.fileName] = fraction
        listeners.forEach { it.onFileProgress(job.tileKey, file.fileName, fraction) }
        onProgress(progress)
    }

    private fun completeFile(file: TileDownloadFile, onProgress: (Double) -> Unit) {
        synchronized(job) {
            file.state = TileDownloadFile.COMPLETED
            file.reason = null
        }
        TileDownloadJobStore.save(context, job)
        fractions[file.fileName] = 1.0
        listeners.forEach { it.onFileCompleted(job.tileKey, file.fileName) }
        onProgress(progress)
    }

    private fun failFile(file: TileDownloadFile, reason: String) {
        synchronized(job) {
            file.state = TileDownloadFile.FAILED
            file.reason = reason
        }
        TileDownloadJobStore.save(context, job)
    }

    /**
     * Ends the job: cancelled when it was cancelled, completed when every file is whole and failed otherwise,
     * where a file that was never tried, after the token was rejected, fails with that same reason.
     */
    private fun finish() {
        synchronized(job) {
            job.state = when {
                cancelled -> TileDownloadJob.CANCELLED
                job.files.all { it.state == TileDownloadFile.COMPLETED } -> TileDownloadJob.COMPLETED
                else -> TileDownloadJob.FAILED
            }
            if (job.state == TileDownloadJob.FAILED) {
                job.files.filter { it.state == TileDownloadFile.PENDING }.forEach {
                    it.state = TileDownloadFile.FAILED
                    it.reason = rejection ?: "not downloaded"
                }
            }
        }
        TileDownloadJobStore.save(context, job)
        listeners.forEach { it.onTileFinished(job) }
    }

    companion object {
        private const val MAX_RETRIES = 2
        private const val RETRY_DELAY_MS = 5_000L
        private const val NETWORK_WAIT_MS = 120_000L
        private const val NETWORK_POLL_MS = 2_000L
        private const val PROGRESS_INTERVAL_MS = 250L
        private const val CANCEL_WAIT_SECONDS = 5L
        private const val BUFFER_SIZE = 64 * 1024

        private val sharedClient by lazy {
            OkHttpClient.Builder()
                .readTimeout(60, TimeUnit.SECONDS)
                .build()
        }

        /** The download that is running in this process, null when there is none */
        @Volatile
        var current: TileDownloader? = null
            private set

        /** Whoever wants to hear about the downloads of this process, the plugin when the app is running */
        val listeners = CopyOnWriteArraySet<Listener>()
    }
}
