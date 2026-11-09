package com.mapeak.offline

import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class TileDownloadJobStoreTest {

    @Before
    fun setUp() {
        jobFile.delete()
    }

    @After
    fun tearDown() {
        jobFile.delete()
    }

    @Test
    fun shouldLoadTheJobAsItWasSaved() {
        val job = jobOf("a.pmtiles", "b.pmtiles", concurrency = 3, headers = mapOf("Authorization" to "Bearer token"))
        job.files[1].state = TileDownloadFile.FAILED
        job.files[1].reason = "HTTP 500"
        job.state = TileDownloadJob.FAILED

        TileDownloadJobStore.save(context, job)
        val loaded = TileDownloadJobStore.load(context)!!

        assertEquals(job.tileKey, loaded.tileKey)
        assertEquals(job.files.map { it.fileName }, loaded.files.map { it.fileName })
        assertEquals(job.files.map { it.url }, loaded.files.map { it.url })
        assertEquals(listOf(TileDownloadFile.PENDING, TileDownloadFile.FAILED), loaded.files.map { it.state })
        assertEquals(listOf(null, "HTTP 500"), loaded.files.map { it.reason })
        assertEquals(mapOf("Authorization" to "Bearer token"), loaded.headers)
        assertEquals(3, loaded.concurrency)
        assertEquals(TileDownloadJob.FAILED, loaded.state)
    }

    @Test
    fun shouldLoadNothingWhenNoJobWasSaved() {
        assertNull(TileDownloadJobStore.load(context))
    }

    @Test
    fun shouldLoadNothingFromAFileThatCanNotBeRead() {
        jobFile.writeText("{ not json")

        assertNull(TileDownloadJobStore.load(context))
    }
}
