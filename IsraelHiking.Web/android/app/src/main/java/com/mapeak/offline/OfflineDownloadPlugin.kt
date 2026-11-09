package com.mapeak.offline

import android.Manifest
import android.os.Build
import android.os.Handler
import android.os.Looper
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import org.json.JSONObject

/**
 * Downloads the offline files of a tile to completion while the app is in the background, see
 * TileDownloads. The files are written where the app already reads them from, and the app moves them
 * once the whole tile arrived.
 *
 * The saved job is the source of truth for whatever the app missed while it was not listening, the
 * events are only what it hears while it is.
 */
@CapacitorPlugin(
    name = "OfflineDownload",
    permissions = [Permission(alias = OfflineDownloadPlugin.NOTIFICATIONS, strings = [Manifest.permission.POST_NOTIFICATIONS])]
)
class OfflineDownloadPlugin : Plugin(), TileDownloader.Listener {
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun load() {
        TileDownloader.listeners.add(this)
    }

    override fun handleOnDestroy() {
        TileDownloader.listeners.remove(this)
    }

    /**
     * Starts the download of a tile, asking for the notifications permission first on Android 13 and above -
     * the download shows its progress in a notification. It is started whether or not it was granted.
     */
    @Suppress("unused")
    @PluginMethod
    fun startTileDownload(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            requestPermissionForAlias(NOTIFICATIONS, call, "notificationsPermissionCallback")
            return
        }
        startTileDownloadWithPermission(call)
    }

    @Suppress("unused")
    @PermissionCallback
    fun notificationsPermissionCallback(call: PluginCall) {
        startTileDownloadWithPermission(call)
    }

    private fun startTileDownloadWithPermission(call: PluginCall) {
        val tileKey = call.getString("tileKey")
        if (tileKey.isNullOrBlank()) {
            call.reject("tileKey is required")
            return
        }
        val files = call.getArray("files") ?: return call.reject("files is required")
        val downloadFiles = (0 until files.length()).map {
            val file = files.getJSONObject(it)
            TileDownloadFile(file.getString("fileName"), file.getString("url"))
        }
        if (downloadFiles.any { it.fileName.isBlank() || it.fileName.contains('/') || it.fileName.startsWith(".") }) {
            call.reject("A file name must be a plain file name")
            return
        }
        val headers = call.getObject("headers") ?: JSObject()
        val job = TileDownloadJob(
            tileKey,
            downloadFiles,
            headers.keys().asSequence().associateWith { headers.getString(it).orEmpty() },
            call.getInt("concurrency") ?: DEFAULT_CONCURRENCY
        )
        try {
            TileDownloads.start(context, job)
            call.resolve()
        } catch (ex: Exception) {
            call.reject("Failed to start the download of $tileKey: ${ex.message}", ex)
        }
    }

    @Suppress("unused")
    @PluginMethod
    fun cancelTileDownload(call: PluginCall) {
        val tileKey = call.getString("tileKey")
        if (tileKey.isNullOrBlank()) {
            call.reject("tileKey is required")
            return
        }
        TileDownloads.cancel(context, tileKey)
        call.resolve()
    }

    @Suppress("unused")
    @PluginMethod
    fun getTileDownload(call: PluginCall) {
        val tileKey = call.getString("tileKey")
        if (tileKey.isNullOrBlank()) {
            call.reject("tileKey is required")
            return
        }
        val job = TileDownloads.get(context, tileKey)
        if (job == null) {
            call.resolve(JSObject().put("state", TileDownloadJob.NONE).put("completedFiles", JSArray()).put("failedFiles", JSArray()))
            return
        }
        call.resolve(toResult(job))
    }

    override fun onFileProgress(tileKey: String, fileName: String, fraction: Double) {
        notify("fileProgress", JSObject().put("tileKey", tileKey).put("fileName", fileName).put("fraction", fraction))
    }

    override fun onFileCompleted(tileKey: String, fileName: String) {
        notify("fileCompleted", JSObject().put("tileKey", tileKey).put("fileName", fileName))
    }

    override fun onTileFinished(job: TileDownloadJob) {
        val result = toResult(job)
        notify("tileFinished", JSObject().put("tileKey", job.tileKey).put("state", result.getString("state"))
            .put("failedFiles", result.getJSONArray("failedFiles")))
    }

    private fun notify(eventName: String, data: JSObject) {
        mainHandler.post { notifyListeners(eventName, data) }
    }

    private fun toResult(job: TileDownloadJob): JSObject = synchronized(job) {
        JSObject()
            .put("state", job.state)
            .put("completedFiles", JSArray(job.files.filter { it.state == TileDownloadFile.COMPLETED }.map { it.fileName }))
            .put("failedFiles", JSArray(job.files.filter { it.state == TileDownloadFile.FAILED }.map {
                JSONObject().put("fileName", it.fileName).put("reason", it.reason)
            }))
    }

    companion object {
        const val NOTIFICATIONS = "notifications"
        private const val DEFAULT_CONCURRENCY = 3
    }
}
