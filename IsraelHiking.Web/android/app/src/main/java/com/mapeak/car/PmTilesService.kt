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

    /**
     * An area the app downloaded, as it keeps it next to its files in an "id.area.json" file, see offline-areas.service.ts,
     * where the root files and the tiles that came before areas are areas as well
     */
    private class DownloadedArea(val id: String, val polygons: List<List<List<DoubleArray>>>, val zooms: IntRange) {
        val boundsArea: Double = polygons.flatten().flatten().let { points ->
            (points.maxOf { it[0] } - points.minOf { it[0] }) * (points.maxOf { it[1] } - points.minOf { it[1] })
        }
    }

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
     * The file a tile is read from, mirroring findDownloadedAreaId of pmtiles.service.ts: of the smallest downloaded area
     * that holds the zoom of the tile and overlaps it, so that an area is read before the root files of the whole world.
     * An area holds every tile its polygon touches, so a tile along its border is read from it even when its center is outside.
     * The tile is tested a little inside its edges, so that one that only touches an area, like the neighbour of a tile
     * that came before areas, is not read from it.
     */
    private fun getFileNameByType(z: Int, x: Int, y: Int, type: String): String? {
        val tile = TileBounds(tileLng(x + TILE_INSET, z), tileLat(y + 1 - TILE_INSET, z), tileLng(x + 1 - TILE_INSET, z), tileLat(y + TILE_INSET, z))
        return getDownloadedAreas()
            .filter { area -> z in area.zooms && area.polygons.any { intersects(it, tile) } }
            .firstNotNullOfOrNull { existing("$type+${it.id}.pmtiles") }
    }

    private class TileBounds(val minLng: Double, val minLat: Double, val maxLng: Double, val maxLat: Double) {
        val corners = listOf(doubleArrayOf(minLng, minLat), doubleArrayOf(maxLng, minLat), doubleArrayOf(maxLng, maxLat), doubleArrayOf(minLng, maxLat))

        fun contains(point: DoubleArray): Boolean = point[0] in minLng..maxLng && point[1] in minLat..maxLat
    }

    /**
     * Whether a polygon and a tile overlap: a corner of the tile is in the polygon, a point of the polygon is in the tile,
     * or one of their edges crosses the other's
     */
    private fun intersects(rings: List<List<DoubleArray>>, tile: TileBounds): Boolean {
        if (tile.corners.any { contains(rings, it[0], it[1]) }) {
            return true
        }
        val tileEdges = tile.corners.indices.map { tile.corners[it] to tile.corners[(it + 1) % tile.corners.size] }
        return rings.any { ring ->
            ring.indices.any { index ->
                val start = ring[index]
                val end = ring[(index + 1) % ring.size]
                tile.contains(start) || tileEdges.any { (tileStart, tileEnd) -> crosses(start, end, tileStart, tileEnd) }
            }
        }
    }

    private fun crosses(a: DoubleArray, b: DoubleArray, c: DoubleArray, d: DoubleArray): Boolean =
        side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

    private fun side(a: DoubleArray, b: DoubleArray, point: DoubleArray): Double =
        Math.signum((b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0]))

    private fun existing(fileName: String): String? = if (File(baseDir, fileName).exists()) fileName else null

    /**
     * The areas, smallest first, are read again every so often rather than for every tile, so that one downloaded
     * meanwhile shows up
     */
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
                val properties = area.getJSONObject("properties")
                val zooms = properties.optInt("minZoom", 0)..properties.optInt("maxZoom", Int.MAX_VALUE)
                DownloadedArea(properties.getString("id"), polygons, zooms)
            } catch (_: Exception) {
                null
            }
        }.sortedBy { it.boundsArea }
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

    private fun tileLng(x: Double, z: Int): Double = x / (1 shl z) * 360.0 - 180.0

    private fun tileLat(y: Double, z: Int): Double =
        Math.toDegrees(Math.atan(Math.sinh(Math.PI * (1 - 2 * y / (1 shl z)))))

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
        private const val AREA_FILE_SUFFIX = ".area.json"
        private const val AREAS_REFRESH_MILLIS = 30_000L
        /** How far inside its edges a tile is tested for overlapping an area, as a part of its size, see getFileNameByType */
        private const val TILE_INSET = 0.001
    }
}
