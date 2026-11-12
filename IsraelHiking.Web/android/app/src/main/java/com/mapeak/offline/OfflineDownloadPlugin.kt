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
 * Downloads the offline files of an area to completion while the app is in the background, see
 * AreaDownloads. The files are written where the app already reads them from, and the app moves them
 * once the whole area arrived.
 *
 * The saved job is the source of truth for whatever the app missed while it was not listening, the
 * events are only what it hears while it is.
 */
@CapacitorPlugin(
    name = "OfflineDownload",
    permissions = [Permission(alias = OfflineDownloadPlugin.NOTIFICATIONS, strings = [Manifest.permission.POST_NOTIFICATIONS])]
)
class OfflineDownloadPlugin : Plugin(), AreaDownloader.Listener {
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun load() {
        AreaDownloader.listeners.add(this)
    }

    override fun handleOnDestroy() {
        AreaDownloader.listeners.remove(this)
    }

    /**
     * Starts the download of an area, asking for the notifications permission first on Android 13 and above -
     * the download shows its progress in a notification. It is started whether or not it was granted.
     */
    @Suppress("unused")
    @PluginMethod
    fun startAreaDownload(call: PluginCall) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && getPermissionState(NOTIFICATIONS) != PermissionState.GRANTED) {
            requestPermissionForAlias(NOTIFICATIONS, call, "notificationsPermissionCallback")
            return
        }
        startAreaDownloadWithPermission(call)
    }

    @Suppress("unused")
    @PermissionCallback
    fun notificationsPermissionCallback(call: PluginCall) {
        startAreaDownloadWithPermission(call)
    }

    private fun startAreaDownloadWithPermission(call: PluginCall) {
        val areaId = call.getString("areaId")
        if (areaId.isNullOrBlank()) {
            call.reject("areaId is required")
            return
        }
        val files = call.getArray("files") ?: return call.reject("files is required")
        val downloadFiles = (0 until files.length()).map {
            val file = files.getJSONObject(it)
            AreaDownloadFile(file.getString("fileName"), file.getString("url"))
        }
        if (downloadFiles.any { it.fileName.isBlank() || it.fileName.contains('/') || it.fileName.startsWith(".") }) {
            call.reject("A file name must be a plain file name")
            return
        }
        val headers = call.getObject("headers") ?: JSObject()
        val job = AreaDownloadJob(
            areaId,
            downloadFiles,
            headers.keys().asSequence().associateWith { headers.getString(it).orEmpty() },
            call.getInt("concurrency") ?: DEFAULT_CONCURRENCY
        )
        try {
            AreaDownloads.start(context, job)
            call.resolve(JSObject().put("background", true))
        } catch (ex: Exception) {
            call.reject("Failed to start the download of $areaId: ${ex.message}", ex)
        }
    }

    @Suppress("unused")
    @PluginMethod
    fun cancelAreaDownload(call: PluginCall) {
        val areaId = call.getString("areaId")
        if (areaId.isNullOrBlank()) {
            call.reject("areaId is required")
            return
        }
        AreaDownloads.cancel(context, areaId)
        call.resolve()
    }

    @Suppress("unused")
    @PluginMethod
    fun getAreaDownload(call: PluginCall) {
        val areaId = call.getString("areaId")
        if (areaId.isNullOrBlank()) {
            call.reject("areaId is required")
            return
        }
        val job = AreaDownloads.get(context, areaId)
        if (job == null) {
            call.resolve(JSObject().put("state", AreaDownloadJob.NONE).put("completedFiles", JSArray()).put("failedFiles", JSArray()))
            return
        }
        call.resolve(toResult(job))
    }

    override fun onFileProgress(areaId: String, fileName: String, fraction: Double) {
        notify("fileProgress", JSObject().put("areaId", areaId).put("fileName", fileName).put("fraction", fraction))
    }

    override fun onFileCompleted(areaId: String, fileName: String) {
        notify("fileCompleted", JSObject().put("areaId", areaId).put("fileName", fileName))
    }

    override fun onAreaFinished(job: AreaDownloadJob) {
        val result = toResult(job)
        notify("areaFinished", JSObject().put("areaId", job.areaId).put("state", result.getString("state"))
            .put("failedFiles", result.getJSONArray("failedFiles")))
    }

    private fun notify(eventName: String, data: JSObject) {
        mainHandler.post { notifyListeners(eventName, data) }
    }

    private fun toResult(job: AreaDownloadJob): JSObject = synchronized(job) {
        JSObject()
            .put("state", job.state)
            .put("completedFiles", JSArray(job.files.filter { it.state == AreaDownloadFile.COMPLETED }.map { it.fileName }))
            .put("failedFiles", JSArray(job.files.filter { it.state == AreaDownloadFile.FAILED }.map {
                JSONObject().put("fileName", it.fileName).put("reason", it.reason)
            }))
    }

    companion object {
        const val NOTIFICATIONS = "notifications"
        private const val DEFAULT_CONCURRENCY = 3
    }
}
