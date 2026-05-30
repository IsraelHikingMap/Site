package com.mapeak.car

import android.content.Context
import ch.poole.geo.pmtiles.Reader
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.IOException
import java.lang.AutoCloseable
import java.util.zip.GZIPInputStream

class PmTilesService(context: Context) : AutoCloseable {
    private val baseDir: File? = context.filesDir
    private val readerCache: MutableMap<String?, Reader> = HashMap()

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
        val data: ByteArray?
        val compression: Byte
        synchronized(reader) {
            data = reader.getTile(z, x, y)
            compression = reader.tileCompression
        }
        return data?.let { decompress(it, compression, fileName) }
    }

    @Synchronized
    @Throws(IOException::class)
    private fun getReader(fileName: String): Reader {
        val cached = readerCache[fileName]
        if (cached != null) {
            return cached
        }
        val file = File(baseDir, fileName)
        if (!file.exists()) {
            throw IOException("PMTiles file not found: " + file.absolutePath)
        }
        val reader = Reader(file)
        readerCache[fileName] = reader
        return reader
    }

    companion object {
        const val TILES_ZOOM: Int = 7

        private const val COMPRESSION_NONE: Byte = 1
        private const val COMPRESSION_GZIP: Byte = 2

        @Throws(IOException::class)
        private fun decompress(data: ByteArray, compression: Byte, fileName: String?): ByteArray? {
            if (compression == COMPRESSION_NONE) {
                return data
            }
            if (compression == COMPRESSION_GZIP) {
                GZIPInputStream(ByteArrayInputStream(data)).use { gzip ->
                    val out = ByteArrayOutputStream(data.size * 2)
                    val buffer = ByteArray(8192)
                    var read: Int
                    while ((gzip.read(buffer).also { read = it }) != -1) {
                        out.write(buffer, 0, read)
                    }
                    return out.toByteArray()
                }
            }
            throw IOException("Unsupported PMTiles tile compression $compression in $fileName")
        }
    }
}
