package com.mapeak.car

import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.Protocol
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody

class SliceProtocolInterceptor internal constructor(private val pmTilesService: PmTilesService) :
        Interceptor {
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

        val offlineAvailable = pmTilesService.isOfflineFileAvailable(z, x, y, type)
        val timeout: Int =
                if (offlineAvailable) ONLINE_TIMEOUT_OFFLINE_AVAILABLE_MS else ONLINE_TIMEOUT_MS

        val timeoutChain =
                chain.withConnectTimeout(timeout, TimeUnit.MILLISECONDS)
                        .withReadTimeout(timeout, TimeUnit.MILLISECONDS)

        var response: Response? = null
        var networkError: IOException? = null
        try {
            response = timeoutChain.proceed(original)
            if (response.isSuccessful) {
                return response
            }
        } catch (ex: IOException) {
            networkError = ex
        }

        // Close the failed response body to avoid leaks
        response?.close()

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

        // Fallback to PMTiles
        val data =
                pmTilesService.getTileByType(z, x, y, type)
                        ?: throw IOException("PMTiles fallback returned no data for $url")
        return Response.Builder()
                .request(original)
                .protocol(Protocol.HTTP_1_1)
                .code(200)
                .message("OK")
                .body(data.toResponseBody("application/x-protobuf".toMediaType()))
                .build()
    }

    companion object {
        private const val ONLINE_TIMEOUT_MS = 60000
        private const val ONLINE_TIMEOUT_OFFLINE_AVAILABLE_MS = 2000
    }
}
