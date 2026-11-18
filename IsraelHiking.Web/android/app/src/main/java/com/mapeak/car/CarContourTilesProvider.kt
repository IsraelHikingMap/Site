package com.mapeak.car

import com.mapeak.maplibrecontour.DemManager
import com.mapeak.maplibrecontour.DemTileFetcher
import com.mapeak.maplibrecontour.Encoding
import com.mapeak.maplibrecontour.FfiException
import com.mapeak.maplibrecontour.defaultConfig
import com.mapeak.maplibrecontour.parseThresholdSpec
import java.io.IOException
import java.util.concurrent.ConcurrentHashMap
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Generates vector contour tiles on the fly from a terrain (DEM) source. The heavy lifting is done
 * by the maplibre-contour-rs native library: we hand it a [DemTileFetcher] that knows how to
 * download a DEM tile, and it returns a ready-to-render MVT for any `z/x/y`.
 * [SliceProtocolInterceptor] is what routes contour tile requests here, passing the units carried
 * in the tile URL.
 *
 * Units (metric/imperial) change the elevation multiplier and the contour thresholds, so a manager
 * is built and cached per units string; the managers are thread-safe and shared across requests.
 *
 * The DEM is read up to the same zoom as on the web, `MapService.DEM_MAX_ZOOM`. It has its higher
 * zooms only where there is data, and the library falls back to the zoom below on a tile the fetcher
 * answers with null.
 */
class CarContourTilesProvider internal constructor(private val okHttpClient: OkHttpClient) {

    private val managers = ConcurrentHashMap<String, DemManager>()
    private val config =
            defaultConfig()
                    .copy(
                            encoding = Encoding.TERRARIUM,
                            demUrlPattern =
                                    "https://mapeak.com/vector/data/raster-dem/{z}/{x}/{y}.webp?use=slice",
                            demMaxZoom = 14.toUByte(),
                            overzoom = 1.toUByte(),
                            layerName = "contours",
                            elevationKey = "ele",
                            levelKey = "level",
                    )

    /**
     * This needs to be provided in order to force the Rust code to use the okhttp, so that "use=slice"
     * will route back to pmtiles/online mode. A 404 is a tile the DEM does not have and the library falls
     * back to the zoom below, any other failure is an error and not missing data.
     */
    private val fetcher =
            object : DemTileFetcher {
                override fun fetch(url: String): ByteArray? {
                    val request = Request.Builder().url(url).build()
                    try {
                        okHttpClient.newCall(request).execute().use { response ->
                            if (response.code == SliceProtocolInterceptor.HTTP_NOT_FOUND) {
                                return null
                            }
                            if (!response.isSuccessful) {
                                throw FfiException.Tiler("Failed to get $url: HTTP ${response.code}")
                            }
                            return response.body.bytes()
                        }
                    } catch (ex: IOException) {
                        throw FfiException.Tiler("Failed to get $url: ${ex.message}")
                    }
                }
            }

    fun getTile(z: Int, x: Int, y: Int, units: String): ByteArray {
        val manager =
                managers.computeIfAbsent(units) {
                    DemManager(
                            fetcher,
                            config.copy(
                                    multiplier = multiplierForUnits(it),
                                    thresholds = thresholdsForUnits(it),
                            )
                    )
                }
        return manager.tile(z.toUByte(), x.toUInt(), y.toUInt())
    }

    companion object {
        private const val UNIT_IMPERIAL = "imperial"
        private const val METRIC_MULTIPLIER = 1.0f
        private const val IMPERIAL_MULTIPLIER = 3.28084f
        private const val METRIC_THRESHOLDS = "9*500*2500~10*200*1000~11*100*500~12*50*250~13*20*100~14*10*50"
        private const val IMPERIAL_THRESHOLDS = "9*1000*5000~10*500*2500~11*200*1000~12*100*500~13*40*200~14*20*100"

        private fun multiplierForUnits(units: String): Float =
                if (units == UNIT_IMPERIAL) IMPERIAL_MULTIPLIER else METRIC_MULTIPLIER

        private fun thresholdsForUnits(units: String) =
                parseThresholdSpec(
                        if (units == UNIT_IMPERIAL) IMPERIAL_THRESHOLDS else METRIC_THRESHOLDS
                )
    }
}
