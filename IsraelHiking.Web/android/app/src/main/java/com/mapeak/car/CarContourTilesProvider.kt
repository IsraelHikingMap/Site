package com.mapeak.car

import com.mapeak.maplibrecontour.DemManager
import com.mapeak.maplibrecontour.DemTileFetcher
import com.mapeak.maplibrecontour.Encoding
import com.mapeak.maplibrecontour.defaultConfig
import com.mapeak.maplibrecontour.parseThresholdSpec
import java.util.concurrent.ConcurrentHashMap
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Generates vector contour tiles on the fly from a terrain (DEM) source, mirroring what
 * maplibre-contour does on the web. The heavy lifting is done by the maplibre-contour-rs native
 * library: we hand it a [DemTileFetcher] that knows how to download a DEM tile, and it returns a
 * ready-to-render MVT for any `z/x/y`. [SliceProtocolInterceptor] is what routes contour tile
 * requests here, passing the units carried in the tile URL.
 *
 * Units (metric/imperial) only change the elevation multiplier, so a manager is built and cached per
 * units string; the managers are thread-safe and shared across requests.
 */
class CarContourTilesProvider internal constructor(private val okHttpClient: OkHttpClient) {

    // The layer/attribute names and thresholds must match what the style's contour layers expect
    // (see the web useContourProtocol in default-style.service.ts, which configures the same values).
    private val config =
            defaultConfig()
                    .copy(
                            encoding = Encoding.TERRARIUM,
                            demUrlPattern =
                                    "https://global.israelhikingmap.workers.dev/jaxa_terrarium0-11_v2/{z}/{x}/{y}.webp?use=slice",
                            demMaxZoom = 11.toUByte(),
                            overzoom = 1.toUByte(),
                            thresholds =
                                    parseThresholdSpec(
                                            "11*200*1000~12*10*100~13*10*100~14*10*100~15*10*100"
                                    ),
                            layerName = "contours",
                            elevationKey = "ele",
                            levelKey = "level",
                    )

    // Called by the native library to download the raw DEM tile bytes for a fully-resolved URL.
    // okHttpClient carries SliceProtocolInterceptor (the `use=slice` marker in demUrlPattern), so
    // DEM fetches get the same offline (PMTiles) fallback the rest of the map enjoys. Returning null
    // tells the library there is no data for that tile, which it renders as an empty contour tile.
    private val fetcher =
            object : DemTileFetcher {
                override fun fetch(url: String): ByteArray? {
                    val request = Request.Builder().url(url).build()
                    okHttpClient.newCall(request).execute().use { response ->
                        if (!response.isSuccessful) {
                            return null
                        }
                        return response.body.bytes()
                    }
                }
            }

    // One manager per units string; metric and imperial differ only by the elevation multiplier.
    private val managers = ConcurrentHashMap<String, DemManager>()

    fun getTile(z: Int, x: Int, y: Int, units: String): ByteArray {
        val manager =
                managers.computeIfAbsent(units) {
                    DemManager(fetcher, config.copy(multiplier = multiplierForUnits(it)))
                }
        return manager.tile(z.toUByte(), x.toUInt(), y.toUInt())
    }

    companion object {
        private const val UNIT_IMPERIAL = "imperial"
        private const val METRIC_MULTIPLIER = 1.0f
        private const val IMPERIAL_MULTIPLIER = 3.28084f

        private fun multiplierForUnits(units: String): Float =
                if (units == UNIT_IMPERIAL) IMPERIAL_MULTIPLIER else METRIC_MULTIPLIER
    }
}
