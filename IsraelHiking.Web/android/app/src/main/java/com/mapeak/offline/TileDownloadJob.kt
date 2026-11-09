package com.mapeak.offline

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * A file of a tile download and how far it got, the reason is set only once the file failed.
 */
class TileDownloadFile(
    val fileName: String,
    val url: String,
    var state: String = PENDING,
    var reason: String? = null
) {
    fun toJson(): JSONObject = JSONObject()
        .put("fileName", fileName)
        .put("url", url)
        .put("state", state)
        .put("reason", reason)

    companion object {
        const val PENDING = "pending"
        const val COMPLETED = "completed"
        const val FAILED = "failed"

        fun fromJson(json: JSONObject) = TileDownloadFile(
            json.getString("fileName"),
            json.getString("url"),
            json.getString("state"),
            json.optString("reason").ifEmpty { null }
        )
    }
}

/**
 * The download of the files of one tile, as one job. It is kept in a file of its own so that a process
 * that was restarted can still report it and continue the files that are still missing - it is the source
 * of truth, while whatever is held in memory is only a copy of it.
 * Its fields are changed by several downloading threads at once, so they are changed and read while
 * holding the job itself.
 */
class TileDownloadJob(
    val tileKey: String,
    val files: List<TileDownloadFile>,
    val headers: Map<String, String>,
    val concurrency: Int,
    var state: String = RUNNING
) {
    fun toJson(): JSONObject = JSONObject()
        .put("tileKey", tileKey)
        .put("files", JSONArray(files.map { it.toJson() }))
        .put("headers", JSONObject(headers))
        .put("concurrency", concurrency)
        .put("state", state)

    /**
     * Marks the files that are already whole in the offline files directory as completed, they are only
     * given their name once they were downloaded to their end.
     */
    fun markFilesFoundOnDisk(context: Context) {
        val directory = offlineFilesDirectory(context)
        for (file in files) {
            if (file.state != TileDownloadFile.COMPLETED && File(directory, file.fileName).isFile) {
                file.state = TileDownloadFile.COMPLETED
                file.reason = null
            }
        }
    }

    companion object {
        const val RUNNING = "running"
        const val COMPLETED = "completed"
        const val FAILED = "failed"
        const val CANCELLED = "cancelled"
        const val NONE = "none"

        /**
         * Where the files are downloaded to, the same directory the app reads them from as "offline-files"
         * in the capacitor cache directory.
         */
        fun offlineFilesDirectory(context: Context) = File(context.cacheDir, "offline-files")

        fun fromJson(json: JSONObject): TileDownloadJob {
            val files = json.getJSONArray("files")
            val headers = json.getJSONObject("headers")
            return TileDownloadJob(
                json.getString("tileKey"),
                (0 until files.length()).map { TileDownloadFile.fromJson(files.getJSONObject(it)) },
                headers.keys().asSequence().associateWith { headers.getString(it) },
                json.getInt("concurrency"),
                json.getString("state")
            )
        }
    }
}

/**
 * Keeps the one tile download there is in a json file. It is written to a file next to it first and then
 * renamed over it, so that a process that is killed while writing never leaves a file that can not be read.
 */
object TileDownloadJobStore {
    private const val FILE_NAME = "offline-download-job.json"

    @Synchronized
    fun load(context: Context): TileDownloadJob? {
        val file = File(context.filesDir, FILE_NAME)
        if (!file.isFile) {
            return null
        }
        return try {
            TileDownloadJob.fromJson(JSONObject(file.readText()))
        } catch (_: Exception) {
            null
        }
    }

    @Synchronized
    fun save(context: Context, job: TileDownloadJob) {
        val json = synchronized(job) { job.toJson().toString() }
        val file = File(context.filesDir, FILE_NAME)
        val temporaryFile = File(context.filesDir, "$FILE_NAME.tmp")
        temporaryFile.writeText(json)
        if (!temporaryFile.renameTo(file)) {
            file.delete()
            temporaryFile.renameTo(file)
        }
    }
}
