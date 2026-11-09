package com.mapeak.offline

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/**
 * Starting a download is left to the device, a user-initiated job can only be scheduled while the app is
 * visible, which it is not while instrumented tests run. These are the paths that hand nothing to the system.
 */
@RunWith(AndroidJUnit4::class)
class TileDownloadsTest {
    private val events = RecordedEvents()

    @Before
    fun setUp() {
        offlineFilesDirectory.deleteRecursively()
        offlineFilesDirectory.mkdirs()
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
    fun shouldReportNoDownloadForATileThatIsNotTheOneSaved() {
        TileDownloadJobStore.save(context, jobOf("a.pmtiles"))

        assertNull(TileDownloads.get(context, "7-76-52"))
    }

    @Test
    fun shouldCompleteARunningDownloadWhoseProcessWasKilledOnceAllItsFilesAreOnDisk() {
        TileDownloadJobStore.save(context, jobOf("a.pmtiles", "b.pmtiles"))
        File(offlineFilesDirectory, "a.pmtiles").writeText("a")
        File(offlineFilesDirectory, "b.pmtiles").writeText("b")

        val job = TileDownloads.get(context, "7-76-51")!!

        assertEquals(TileDownloadJob.COMPLETED, job.state)
        assertTrue(job.files.all { it.state == TileDownloadFile.COMPLETED })
        assertEquals(TileDownloadJob.COMPLETED, TileDownloadJobStore.load(context)!!.state)
    }

    @Test
    fun shouldReportTheFilesOfAnEndedDownloadThatAreOnDiskAsCompleted() {
        val saved = jobOf("a.pmtiles", "b.pmtiles")
        saved.state = TileDownloadJob.FAILED
        TileDownloadJobStore.save(context, saved)
        File(offlineFilesDirectory, "a.pmtiles").writeText("a")

        val job = TileDownloads.get(context, "7-76-51")!!

        assertEquals(TileDownloadJob.FAILED, job.state)
        assertEquals(listOf(TileDownloadFile.COMPLETED, TileDownloadFile.PENDING), job.files.map { it.state })
    }

    @Test
    fun shouldCancelADownloadDeletingItsPartialFilesAndKeepingTheCompletedOnes() {
        TileDownloadJobStore.save(context, jobOf("a.pmtiles", "b.pmtiles"))
        File(offlineFilesDirectory, "a.pmtiles").writeText("a")
        File(offlineFilesDirectory, "b.pmtiles.part").writeText("b")

        TileDownloads.cancel(context, "7-76-51")

        assertEquals(TileDownloadJob.CANCELLED, TileDownloadJobStore.load(context)!!.state)
        assertTrue(File(offlineFilesDirectory, "a.pmtiles").exists())
        assertFalse(File(offlineFilesDirectory, "b.pmtiles.part").exists())
        assertEquals(listOf(TileDownloadJob.CANCELLED), events.finishedStates)
    }

    @Test
    fun shouldLeaveTheDownloadOfAnotherTileAsItIsWhenCancelling() {
        TileDownloadJobStore.save(context, jobOf("a.pmtiles"))
        File(offlineFilesDirectory, "a.pmtiles.part").writeText("a")

        TileDownloads.cancel(context, "7-76-52")

        assertEquals(TileDownloadJob.RUNNING, TileDownloadJobStore.load(context)!!.state)
        assertTrue(File(offlineFilesDirectory, "a.pmtiles.part").exists())
        assertTrue(events.finishedStates.isEmpty())
    }
}
