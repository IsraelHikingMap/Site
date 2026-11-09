package com.mapeak.offline

import androidx.test.ext.junit.runners.AndroidJUnit4
import okhttp3.Request
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlin.concurrent.thread

/**
 * The downloader against answers the tests give through an OkHttp interceptor, so nothing reaches the
 * network. A retry still waits for the device to have a network, so the device needs one.
 */
@RunWith(AndroidJUnit4::class)
class TileDownloaderTest {
    private val requests = CopyOnWriteArrayList<Request>()
    private val events = RecordedEvents()

    @Before
    fun setUp() {
        offlineFilesDirectory.deleteRecursively()
        jobFile.delete()
        TileDownloader.listeners.add(events)
    }

    @After
    fun tearDown() {
        TileDownloader.listeners.remove(events)
        offlineFilesDirectory.deleteRecursively()
        jobFile.delete()
    }

    @Test
    fun shouldDownloadEveryFileOfTheJobUnderItsNameAndCompleteIt() {
        val job = jobOf("a.pmtiles", "b.pmtiles", concurrency = 2)
        val client = clientAnswering(requests) { respond(it, 200, bodyOf(fileNameOf(it).toByteArray())) }

        assertTrue(TileDownloader(context, job, client, 0).run {})

        assertEquals("a.pmtiles", File(offlineFilesDirectory, "a.pmtiles").readText())
        assertEquals("b.pmtiles", File(offlineFilesDirectory, "b.pmtiles").readText())
        assertFalse(File(offlineFilesDirectory, "a.pmtiles.part").exists())
        assertEquals(TileDownloadJob.COMPLETED, job.state)
        assertEquals(TileDownloadJob.COMPLETED, TileDownloadJobStore.load(context)?.state)
        assertEquals(setOf("a.pmtiles", "b.pmtiles"), events.completedFiles.toSet())
        assertEquals(listOf(TileDownloadJob.COMPLETED), events.finishedStates)
    }

    @Test
    fun shouldStartTheFilesInTheOrderOfTheJob() {
        val job = jobOf("c.pmtiles", "a.pmtiles", "b.pmtiles")
        val client = clientAnswering(requests) { respond(it, 200, bodyOf(ByteArray(1))) }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(listOf("c.pmtiles", "a.pmtiles", "b.pmtiles"), requests.map { it.url.pathSegments.last() })
    }

    @Test
    fun shouldSendTheHeadersOfTheJob() {
        val job = jobOf("a.pmtiles", headers = mapOf("Authorization" to "Bearer token"))
        val client = clientAnswering(requests) { respond(it, 200, bodyOf(ByteArray(1))) }

        TileDownloader(context, job, client, 0).run {}

        assertEquals("Bearer token", requests.single().header("Authorization"))
    }

    @Test
    fun shouldNotDownloadAgainAFileThatIsAlreadyWholeOnDisk() {
        offlineFilesDirectory.mkdirs()
        File(offlineFilesDirectory, "a.pmtiles").writeText("already here")
        val job = jobOf("a.pmtiles", "b.pmtiles")
        val client = clientAnswering(requests) { respond(it, 200, bodyOf(ByteArray(1))) }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(listOf("b.pmtiles"), requests.map { it.url.pathSegments.last() })
        assertEquals("already here", File(offlineFilesDirectory, "a.pmtiles").readText())
        assertEquals(TileDownloadJob.COMPLETED, job.state)
    }

    @Test
    fun shouldFailAFileOnAnHttpErrorWithoutTryingItAgainAndStillDownloadTheOthers() {
        val job = jobOf("a.pmtiles", "b.pmtiles")
        val client = clientAnswering(requests) {
            if (fileNameOf(it) == "a.pmtiles") respond(it, 404, bodyOf(ByteArray(0))) else respond(it, 200, bodyOf(ByteArray(1)))
        }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(1, requests.count { it.url.pathSegments.last() == "a.pmtiles" })
        assertEquals(TileDownloadFile.FAILED, job.files[0].state)
        assertEquals("HTTP 404", job.files[0].reason)
        assertEquals(TileDownloadFile.COMPLETED, job.files[1].state)
        assertEquals(TileDownloadJob.FAILED, job.state)
        assertFalse(File(offlineFilesDirectory, "a.pmtiles").exists())
        assertEquals(listOf(TileDownloadJob.FAILED), events.finishedStates)
    }

    @Test
    fun shouldFailTheWholeJobAtOnceWhenTheTokenIsNotAccepted() {
        val job = jobOf("a.pmtiles", "b.pmtiles", "c.pmtiles")
        val client = clientAnswering(requests) { respond(it, 401, bodyOf(ByteArray(0))) }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(1, requests.size)
        assertEquals(TileDownloadJob.FAILED, job.state)
        assertTrue(job.files.all { it.state == TileDownloadFile.FAILED && it.reason == "HTTP 401" })
    }

    @Test
    fun shouldTryAFileTwiceMoreOnANetworkErrorAndThenFailIt() {
        val job = jobOf("a.pmtiles")
        val client = clientAnswering(requests) { respond(it, 200, droppedBody()) }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(3, requests.size)
        assertEquals(TileDownloadFile.FAILED, job.files[0].state)
        assertTrue(job.files[0].reason!!.startsWith("network error"))
        assertFalse(File(offlineFilesDirectory, "a.pmtiles.part").exists())
    }

    @Test
    fun shouldCompleteAFileThatIsDownloadedOnItsRetry() {
        val job = jobOf("a.pmtiles")
        val client = clientAnswering(requests) {
            if (requests.size == 1) respond(it, 200, droppedBody()) else respond(it, 200, bodyOf("whole".toByteArray()))
        }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(2, requests.size)
        assertEquals("whole", File(offlineFilesDirectory, "a.pmtiles").readText())
        assertEquals(TileDownloadJob.COMPLETED, job.state)
    }

    @Test
    fun shouldTryAgainAFileWhoseBodyEndedBeforeItsContentLength() {
        val job = jobOf("a.pmtiles")
        val client = clientAnswering(requests) {
            if (requests.size == 1) respond(it, 200, bodyOf("half".toByteArray(), 8)) else respond(it, 200, bodyOf("complete".toByteArray()))
        }

        TileDownloader(context, job, client, 0).run {}

        assertEquals(2, requests.size)
        assertEquals("complete", File(offlineFilesDirectory, "a.pmtiles").readText())
    }

    @Test
    fun shouldCompleteAFileThatHasNoContentLengthOnceItsBodyEnds() {
        val job = jobOf("a.pmtiles")
        val client = clientAnswering(requests) { respond(it, 200, bodyOf("streamed".toByteArray(), -1)) }

        TileDownloader(context, job, client, 0).run {}

        assertEquals("streamed", File(offlineFilesDirectory, "a.pmtiles").readText())
        assertEquals(TileDownloadJob.COMPLETED, job.state)
        // Without a length there is nothing to tell how far the file got
        assertTrue(events.progress.all { it.second == 0.0 })
    }

    @Test
    fun shouldReportTheProgressOfAFileAndOfTheWholeTile() {
        val job = jobOf("a.pmtiles", "b.pmtiles")
        val client = clientAnswering(requests) { respond(it, 200, bodyOf(ByteArray(10))) }
        val tileProgress = CopyOnWriteArrayList<Double>()

        TileDownloader(context, job, client, 0).run { tileProgress.add(it) }

        assertTrue(events.progress.contains("a.pmtiles" to 1.0))
        assertEquals(1.0, tileProgress.last(), 0.0)
    }

    @Test
    fun shouldEndACancelledJobAsCancelledKeepingTheFilesThatCompletedAndNoPartialFile() {
        val job = jobOf("a.pmtiles", "b.pmtiles")
        val reading = CountDownLatch(1)
        val client = clientAnswering(requests) {
            if (fileNameOf(it) == "a.pmtiles") respond(it, 200, bodyOf(ByteArray(1))) else respond(it, 200, hangingBody(it, reading))
        }
        val downloader = TileDownloader(context, job, client, 0)
        var ended: Boolean? = null
        val running = thread { ended = downloader.run {} }

        assertTrue(reading.await(10, TimeUnit.SECONDS))
        downloader.cancel()
        running.join(10_000)

        assertEquals(true, ended)
        assertEquals(TileDownloadJob.CANCELLED, job.state)
        assertTrue(File(offlineFilesDirectory, "a.pmtiles").exists())
        assertFalse(File(offlineFilesDirectory, "b.pmtiles.part").exists())
        assertEquals(listOf(TileDownloadJob.CANCELLED), events.finishedStates)
    }

    @Test
    fun shouldLeaveAStoppedJobRunningForANewRunToContinueOnlyTheMissingFiles() {
        val job = jobOf("a.pmtiles", "b.pmtiles")
        val reading = CountDownLatch(1)
        val stoppingClient = clientAnswering(requests) {
            if (fileNameOf(it) == "a.pmtiles") respond(it, 200, bodyOf(ByteArray(1))) else respond(it, 200, hangingBody(it, reading))
        }
        val downloader = TileDownloader(context, job, stoppingClient, 0)
        var ended: Boolean? = null
        val running = thread { ended = downloader.run {} }

        assertTrue(reading.await(10, TimeUnit.SECONDS))
        downloader.stop()
        running.join(10_000)

        assertEquals(false, ended)
        assertTrue(events.finishedStates.isEmpty())
        assertFalse(File(offlineFilesDirectory, "b.pmtiles.part").exists())
        val savedJob = TileDownloadJobStore.load(context)!!
        assertEquals(TileDownloadJob.RUNNING, savedJob.state)
        assertEquals(TileDownloadFile.COMPLETED, savedJob.files[0].state)

        requests.clear()
        val client = clientAnswering(requests) { respond(it, 200, bodyOf(ByteArray(1))) }
        assertTrue(TileDownloader(context, savedJob, client, 0).run {})

        assertEquals(listOf("b.pmtiles"), requests.map { it.url.pathSegments.last() })
        assertEquals(TileDownloadJob.COMPLETED, savedJob.state)
    }
}
