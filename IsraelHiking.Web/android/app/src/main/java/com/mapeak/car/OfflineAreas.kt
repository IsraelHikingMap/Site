package com.mapeak.car

import java.io.File
import org.json.JSONArray
import org.json.JSONObject

/**
 * The areas the app downloaded, as it keeps them next to their files in "id.area.json" files, where the root files and
 * the old tiles are areas as well - the counterpart of offline-areas.service.ts on the web client,
 * and of OfflineAreas.swift on iOS.
 */
class OfflineAreas(private val baseDir: File?) {
    private class DownloadedArea(val id: String, val polygons: List<List<List<DoubleArray>>>, val zooms: IntRange) {
        val boundsArea: Double = SpatialHelper.getBoundsArea(polygons)
    }

    private var areas: List<DownloadedArea> = emptyList()
    private var areasReadAt = 0L

    /**
     * The downloaded area whose files hold a tile, the smallest of them where they overlap, so that an area is read before
     * the root files of the whole world. An area holds every tile its polygon touches, so a tile along its border is read
     * from it even when its center is outside. The tile is tested a little inside its edges, so that one that only touches
     * an area, like the neighbour of an old tile, is not read from it.
     */
    fun findDownloadedAreaIdOfTile(z: Int, x: Int, y: Int): String? {
        val tile = SpatialHelper.getTilePolygon(x, y, z, TILE_INSET)
        return getDownloadedAreas()
            .firstOrNull { area -> z in area.zooms && area.polygons.any { SpatialHelper.intersects(it, tile) } }
            ?.id
    }

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

    companion object {
        private const val AREA_FILE_SUFFIX = ".area.json"
        private const val AREAS_REFRESH_MILLIS = 30_000L
        /** How far inside its edges a tile is tested for overlapping an area, as a part of its size, see findDownloadedAreaIdOfTile */
        private const val TILE_INSET = 0.001
    }
}
