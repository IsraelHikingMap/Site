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

    @Throws(IOException::class)
    fun getTileByType(z: Int, x: Int, y: Int, type: String): ByteArray? {
        return getTileFromFile(getFileNameByType(z, x, y, type), z, x, y)
    }

    fun isOfflineFileAvailable(z: Int, x: Int, y: Int, type: String): Boolean {
        return File(baseDir, getFileNameByType(z, x, y, type)).exists()
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

    private fun getFileNameByType(z: Int, x: Int, y: Int, type: String): String {
        if (z >= TILES_ZOOM) {
            val scale = 1 shl (z - TILES_ZOOM)
            val tileX = x / scale
            val tileY = y / scale
            return "$type+$TILES_ZOOM-$tileX-$tileY.pmtiles"
        }
        return type + "-" + (TILES_ZOOM - 1) + ".pmtiles"
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

    companion object {
        const val TILES_ZOOM: Int = 7
    }
}
