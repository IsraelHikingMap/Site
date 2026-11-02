package com.mapeak.car

import android.content.Context
import java.io.File
import java.io.IOException
import java.lang.AutoCloseable
import org.json.JSONArray
import org.json.JSONObject
import com.mapeak.pmtiles.PmTilesReader
import com.mapeak.pmtiles.PmTilesException


class PmTilesService(context: Context) : AutoCloseable {
    private val baseDir: File? = context.filesDir
    private val readerCache: MutableMap<String?, PmTilesReader> = HashMap()
    private var areas: List<DownloadedArea> = emptyList()
    private var areasReadAt = 0L

    /** An area the app downloaded, as it keeps it next to its files in an "id.area.json" file, see offline-areas.service.ts */
    private class DownloadedArea(val id: String, val polygons: List<List<List<DoubleArray>>>)

    @Throws(IOException::class)
    fun getTileByType(z: Int, x: Int, y: Int, type: String): ByteArray? {
        val fileName = getFileNameByType(z, x, y, type) ?: return null
        return getTileFromFile(fileName, z, x, y)
    }

    fun isOfflineFileAvailable(z: Int, x: Int, y: Int, type: String): Boolean {
        return getFileNameByType(z, x, y, type) != null
    }

    @Synchronized
    override fun close() {
        for (reader in readerCache.values) {
            try {
                reader.close()
            } catch (_: Exception) {}
        }
        readerCache.clear()
    }

    /**
     * The file a tile is read from, mirroring getFileNameByType of pmtiles.service.ts: the root file up to its zoom,
     * the zoom 7 tile it is in, the downloaded area its center is in, and below zoom 7 the zoom 6 root file the tiles
     * that came before areas were downloaded with.
     */
    private fun getFileNameByType(z: Int, x: Int, y: Int, type: String): String? {
        if (z <= ROOT_ZOOM) {
            existing("$type-$ROOT_ZOOM.pmtiles")?.let { return it }
        }
        if (z >= TILES_ZOOM) {
            val scale = 1 shl (z - TILES_ZOOM)
            existing("$type+${x / scale}-${y / scale}.pmtiles")?.let { return it }
        }
        return getDownloadedAreas()
            .filter { area -> area.polygons.any { contains(it, tileCenterLng(x, z), tileCenterLat(y, z)) } }
            .firstNotNullOfOrNull { existing("$type+${it.id}.pmtiles") }
            ?: if (z < TILES_ZOOM) existing("$type-${TILES_ZOOM - 1}.pmtiles") else null
    }

    private fun existing(fileName: String): String? = if (File(baseDir, fileName).exists()) fileName else null

    /** The areas are read again every so often rather than for every tile, so that one downloaded meanwhile shows up */
    @Synchronized
    private fun getDownloadedAreas(): List<DownloadedArea> {
        val now = System.currentTimeMillis()
        if (now - areasReadAt < AREAS_REFRESH_MILLIS) {
            return areas
        }
        areasReadAt = now
        areas = baseDir?.listFiles { file -> file.name.endsWith(AREA_FILE_SUFFIX) }.orEmpty().mapNotNull { file ->
            try {
                val area = JSONObject(file.readText())
                val geometry = area.getJSONObject("geometry")
                val coordinates = geometry.getJSONArray("coordinates")
                val polygons = if (geometry.getString("type") == "MultiPolygon") {
                    (0 until coordinates.length()).map { toPolygon(coordinates.getJSONArray(it)) }
                } else {
                    listOf(toPolygon(coordinates))
                }
                DownloadedArea(area.getJSONObject("properties").getString("id"), polygons)
            } catch (_: Exception) {
                null
            }
        }
        return areas
    }

    private fun toPolygon(rings: JSONArray): List<List<DoubleArray>> = (0 until rings.length()).map { ringIndex ->
        val ring = rings.getJSONArray(ringIndex)
        (0 until ring.length()).map { val point = ring.getJSONArray(it); doubleArrayOf(point.getDouble(0), point.getDouble(1)) }
    }

    /** Even-odd ray casting over every ring, so a point in a hole is outside */
    private fun contains(rings: List<List<DoubleArray>>, lng: Double, lat: Double): Boolean {
        var inside = false
        for (ring in rings) {
            var j = ring.size - 1
            for (i in ring.indices) {
                val (xi, yi) = ring[i]
                val (xj, yj) = ring[j]
                if ((yi > lat) != (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
                    inside = !inside
                }
                j = i
            }
        }
        return inside
    }

    private fun tileCenterLng(x: Int, z: Int): Double = (x + 0.5) / (1 shl z) * 360.0 - 180.0

    private fun tileCenterLat(y: Int, z: Int): Double =
        Math.toDegrees(Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / (1 shl z)))))

    @Throws(IOException::class)
    private fun getTileFromFile(fileName: String, z: Int, x: Int, y: Int): ByteArray? {
        val reader = getReader(fileName)
        synchronized(reader) {
            try {
                return reader.getTile(z.toUByte(), x.toUInt(), y.toUInt())
            } catch (ex: PmTilesException) {
                throw IOException("Failed to read tile $z/$x/$y from $fileName", ex)
            }
        }
    }

    @Synchronized
    @Throws(IOException::class)
    private fun getReader(fileName: String): PmTilesReader {
        val cached = readerCache[fileName]
        if (cached != null) {
            return cached
        }
        val file = File(baseDir, fileName)
        if (!file.exists()) {
            throw IOException("PMTiles file not found: " + file.absolutePath)
        }
        val reader = try {
            PmTilesReader.open(baseDir?.absolutePath + "/" + fileName)
        } catch (ex: PmTilesException) {
            throw IOException("Failed to open PMTiles file: " + file.absolutePath, ex)
        }
        readerCache[fileName] = reader
        return reader
    }

    companion object {
        const val TILES_ZOOM: Int = 7
        const val ROOT_ZOOM: Int = 4
        private const val AREA_FILE_SUFFIX = ".area.json"
        private const val AREAS_REFRESH_MILLIS = 30_000L
    }
}
