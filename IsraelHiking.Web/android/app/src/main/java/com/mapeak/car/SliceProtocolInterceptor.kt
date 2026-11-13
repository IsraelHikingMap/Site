package com.mapeak.car

import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody

/**
 * Supports service "use=silce". It also routes the "contour=units" to the contour manager. A tile the server or the
 * offline file does not have is answered with a 404 and not with an error, since the DEM has its higher zooms only
 * where there is data and the contours fall back to the zoom below on a 404. Once the server could not be reached, a tile
 * that has an offline file is read from it without asking the server for a while, see [SKIP_SERVER_AFTER_FAILURE_MS].
 */
class SliceProtocolInterceptor internal constructor(private val pmTilesService: PmTilesService) :
        Interceptor {
    var contoursProvider: CarContourTilesProvider? = null

    @Volatile private var lastServerFailureMillis = 0L

    @Throws(IOException::class)
    override fun intercept(chain: Interceptor.Chain): Response {
        val original = chain.request()

        if ("slice" != original.url.queryParameter("use")) {
            return chain.proceed(original)
        }

        val url = original.url.toString()
        val parts = url.split("/".toRegex()).dropLastWhile { it.isEmpty() }.toTypedArray()
        val type = parts[parts.size - 4]
        val z = parts[parts.size - 3].toInt()
        val x = parts[parts.size - 2].toInt()
        val y =
                parts[parts.size - 1]
                                .split("\\.".toRegex())
                                .dropLastWhile { it.isEmpty() }
                                .toTypedArray()[0]
                        .toInt()

        val contourUnits = original.url.queryParameter("contour")
        val contoursProvider = this.contoursProvider
        if (contoursProvider != null && contourUnits != null) {
            val data =
                    try {
                        contoursProvider.getTile(z, x, y, contourUnits)
                    } catch (ex: Exception) {
                        throw IOException("Failed to generate contour tile $z/$x/$y", ex)
                    }
            return Response.Builder()
                    .request(original)
                    .protocol(Protocol.HTTP_1_1)
                    .code(200)
                    .message("OK")
                    .body(data.toResponseBody("application/x-protobuf".toMediaType()))
                    .build()
        }

        val offlineAvailable = pmTilesService.isOfflineFileAvailable(z, x, y, type)
        val sinceServerFailureMillis = System.currentTimeMillis() - lastServerFailureMillis
        if (offlineAvailable && sinceServerFailureMillis < SKIP_SERVER_AFTER_FAILURE_MS) {
            return offlineResponse(original, z, x, y, type)
        }
        val timeout: Int =
                if (offlineAvailable) ONLINE_TIMEOUT_OFFLINE_AVAILABLE_MS else ONLINE_TIMEOUT_MS

        val timeoutChain =
                chain.withConnectTimeout(timeout, TimeUnit.MILLISECONDS)
                        .withReadTimeout(timeout, TimeUnit.MILLISECONDS)

        var response: Response? = null
        var networkError: IOException? = null
        try {
            response = timeoutChain.proceed(original)
            if (response.isSuccessful || response.code == HTTP_NOT_FOUND) {
                return response
            }
        } catch (ex: IOException) {
            networkError = ex
        }

        // Close the failed response body to avoid leaks
        response?.close()
        lastServerFailureMillis = System.currentTimeMillis()

        if (!offlineAvailable) {
            if (networkError != null) {
                throw networkError
            }
            throw IOException(
                    ("Failed to get " +
                            url +
                            (if (response != null) ": HTTP " + response.code else ""))
            )
        }

        return offlineResponse(original, z, x, y, type)
    }

    /** Reads a tile from the offline file, a tile it does not have is a 404 the map replaces with the zoom below */
    private fun offlineResponse(request: Request, z: Int, x: Int, y: Int, type: String): Response {
        val data = pmTilesService.getTileByType(z, x, y, type) ?: return notFound(request)
        return Response.Builder()
                .request(request)
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(data.toResponseBody("application/x-protobuf".toMediaType()))
                .build()
    }

    private fun notFound(request: Request): Response =
            Response.Builder()
                    .request(request)
                    .protocol(Protocol.HTTP_1_1)
                    .code(HTTP_NOT_FOUND)
                    .message("Not Found")
                    .body(ByteArray(0).toResponseBody(null))
                    .build()

    companion object {
        const val HTTP_NOT_FOUND = 404

        /**
         * How long after the server could not be reached a tile that has an offline file is read from it without asking
         * the server first. Without it every zoom the map falls back through for a tile the file does not have would
         * wait for the server again on a slow connection.
         */
        private const val SKIP_SERVER_AFTER_FAILURE_MS = 30000L
        private const val ONLINE_TIMEOUT_MS = 60000
        private const val ONLINE_TIMEOUT_OFFLINE_AVAILABLE_MS = 2000
    }
}
