package com.mapeak.car

import android.content.Context
import java.io.File
import java.io.IOException
import java.lang.AutoCloseable
import com.mapeak.pmtiles.PmTilesReader
import com.mapeak.pmtiles.PmTilesException


class PmTilesService(context: Context) : AutoCloseable {
    private val baseDir: File? = context.filesDir
    private val readerCache: MutableMap<String?, PmTilesReader> = HashMap()
    private val offlineAreas = OfflineAreas(baseDir)

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

    /** The file a tile is read from, the one of the downloaded area that holds it, see OfflineAreas.findDownloadedAreaIdOfTile */
    private fun getFileNameByType(z: Int, x: Int, y: Int, type: String): String? {
        val areaId = offlineAreas.findDownloadedAreaIdOfTile(z, x, y) ?: return null
        val fileName = "$type+$areaId.pmtiles"
        return if (File(baseDir, fileName).exists()) fileName else null
    }

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
}
