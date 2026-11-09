package com.mapeak.offline

import android.content.Context
import androidx.test.platform.app.InstrumentationRegistry
import okhttp3.Interceptor
import okhttp3.MediaType
import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody
import okio.Buffer
import okio.BufferedSource
import okio.Source
import okio.Timeout
import okio.buffer
import java.io.File
import java.io.IOException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch

val context: Context
    get() = InstrumentationRegistry.getInstrumentation().targetContext

val offlineFilesDirectory: File
    get() = TileDownloadJob.offlineFilesDirectory(context)

/** The file TileDownloadJobStore keeps the job in, deleted between tests so that each starts without one */
val jobFile: File
    get() = File(context.filesDir, "offline-download-job.json")

fun jobOf(vararg fileNames: String, concurrency: Int = 1, headers: Map<String, String> = emptyMap()) = TileDownloadJob(
    "7-76-51",
    fileNames.map { TileDownloadFile(it, "https://mapeak.test/offline/$it") },
    headers,
    concurrency
)

/** A client whose requests never reach the network, the answer gives every one of them its response */
fun clientAnswering(requests: MutableList<Request>, answer: (Interceptor.Chain) -> Response): OkHttpClient =
    OkHttpClient.Builder()
        .addInterceptor { chain ->
            requests.add(chain.request())
            answer(chain)
        }
        .build()

fun fileNameOf(chain: Interceptor.Chain): String = chain.request().url.pathSegments.last()

fun respond(chain: Interceptor.Chain, code: Int, body: ResponseBody): Response = Response.Builder()
    .request(chain.request())
    .protocol(Protocol.HTTP_1_1)
    .code(code)
    .message("status $code")
    .body(body)
    .build()

fun bodyOf(bytes: ByteArray, contentLength: Long = bytes.size.toLong()) = bodyOf(contentLength) { Buffer().write(bytes) }

fun bodyOf(contentLength: Long, source: () -> BufferedSource) = object : ResponseBody() {
    private val bufferedSource by lazy(source)
    override fun contentType(): MediaType? = null
    override fun contentLength() = contentLength
    override fun source() = bufferedSource
}

/** A body that fails the way a dropped connection does, before any of it arrived */
fun droppedBody() = bodyOf(100) {
    object : Source {
        override fun read(sink: Buffer, byteCount: Long): Long = throw IOException("connection reset")
        override fun timeout() = Timeout.NONE
        override fun close() = Unit
    }.buffer()
}

/**
 * A body that never arrives, until its call is cancelled - the way a large file is still downloading when a
 * download is cancelled or stopped. The latch is counted down once the body is being read.
 */
fun hangingBody(chain: Interceptor.Chain, reading: CountDownLatch) = bodyOf(100) {
    object : Source {
        override fun read(sink: Buffer, byteCount: Long): Long {
            reading.countDown()
            while (!chain.call().isCanceled()) {
                Thread.sleep(10)
            }
            throw IOException("Canceled")
        }

        override fun timeout() = Timeout.NONE
        override fun close() = Unit
    }.buffer()
}

/** Records what the downloads of the process report, the way the plugin hears it */
class RecordedEvents : TileDownloader.Listener {
    val progress = CopyOnWriteArrayList<Pair<String, Double>>()
    val completedFiles = CopyOnWriteArrayList<String>()
    val finishedStates = CopyOnWriteArrayList<String>()

    override fun onFileProgress(tileKey: String, fileName: String, fraction: Double) {
        progress.add(fileName to fraction)
    }

    override fun onFileCompleted(tileKey: String, fileName: String) {
        completedFiles.add(fileName)
    }

    override fun onTileFinished(job: TileDownloadJob) {
        finishedStates.add(job.state)
    }
}
