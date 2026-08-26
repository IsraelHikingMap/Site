package com.mapeak.valhalla

import android.content.Context
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException

/**
 * The routing tiles on the device.
 *
 * Every downloaded area is a tar of a valhalla tile tree that is extracted into a single shared
 * directory, and is identified by the id of the tile it covers. Valhalla's tiles are keyed by their
 * grid cell, so adjacent areas simply add their own cells and routing can cross from one to the next.
 *
 * Areas do share tiles though - a downloaded tile is roughly 2.8 degrees while valhalla's highway
 * tiles are 4 degrees and its arterial tiles are 1 degree, so a tile on the edge of an area is also
 * in its neighbour's tar. Each area therefore records what it extracted, and deleting one only
 * removes the tiles that no remaining area lists.
 */
class ValhallaTiles(private val context: Context) {

    companion object {
        private const val TILES_DIR_NAME = "valhalla_tiles"

        /**
         * Kept next to the tiles directory rather than inside it, so that valhalla only ever sees
         * tiles in the directory it is pointed at.
         */
        private const val MANIFESTS_DIR_NAME = "valhalla_manifests"
        private const val MANIFEST_EXTENSION = ".txt"
    }

    data class ExtractResult(val extractedFiles: Int, val tilesDir: String)

    fun tilesDir(): File = File(context.filesDir, TILES_DIR_NAME)

    private fun manifestsDir(): File = File(context.filesDir, MANIFESTS_DIR_NAME)

    private fun manifestFile(tileKey: String): File = File(manifestsDir(), tileKey + MANIFEST_EXTENSION)

    fun hasTiles(): Boolean {
        val dir = tilesDir()
        return dir.isDirectory && (dir.list()?.isNotEmpty() == true)
    }

    fun clear() {
        tilesDir().deleteRecursively()
        manifestsDir().deleteRecursively()
    }

    /**
     * The keys of the tiles whose routing tiles are on the device, which is what the manifests are
     * named after. This is what the app knows the downloaded areas by, so it stores nothing itself.
     */
    fun tileKeys(): List<String> = manifestsDir().listFiles()
        ?.filter { it.isFile && it.name.endsWith(MANIFEST_EXTENSION) }
        ?.map { it.name.removeSuffix(MANIFEST_EXTENSION) }
        ?: emptyList()

    /**
     * Extracts the given tar, which is expected to be in the app's files directory, into the tiles
     * directory, and records the tiles it holds under [tileKey]. The tar is deleted afterwards - it
     * is large and is of no use once extracted.
     */
    fun extract(tarFileName: String, tileKey: String): ExtractResult {
        val tar = File(context.filesDir, tarFileName)
        if (!tar.exists()) {
            throw IOException("Tar not found at ${tar.absolutePath}")
        }
        val tilesDir = tilesDir()
        tilesDir.mkdirs()
        val tilesDirPath = tilesDir.canonicalPath
        val extractedPaths = mutableListOf<String>()

        try {
            TarArchiveInputStream(BufferedInputStream(FileInputStream(tar))).use { tarIn ->
                var entry = tarIn.nextEntry
                while (entry != null) {
                    val outFile = File(tilesDir, entry.name)
                    // Do not let an entry name escape the tiles directory
                    if (!outFile.canonicalPath.startsWith(tilesDirPath + File.separator)) {
                        throw IOException("Tar entry is outside of the tiles directory: ${entry.name}")
                    }
                    if (entry.isDirectory) {
                        outFile.mkdirs()
                    } else {
                        outFile.parentFile?.mkdirs()
                        FileOutputStream(outFile).use { tarIn.copyTo(it) }
                        extractedPaths.add(outFile.relativeTo(tilesDir).path)
                    }
                    entry = tarIn.nextEntry
                }
            }
        } finally {
            tar.delete()
        }

        // When an area is downloaded again it might no longer hold tiles it used to
        val removedPaths = readManifest(tileKey) - extractedPaths.toSet()
        writeManifest(tileKey, extractedPaths)
        deleteUnreferenced(removedPaths)

        return ExtractResult(extractedPaths.size, tilesDir.absolutePath)
    }

    /**
     * Removes the tiles of the given area, keeping any tile that a remaining area still lists.
     */
    fun delete(tileKey: String) {
        val paths = readManifest(tileKey)
        manifestFile(tileKey).delete()
        deleteUnreferenced(paths)
    }

    /**
     * Deletes the given tiles, except for those that are listed in a manifest of another area.
     */
    private fun deleteUnreferenced(paths: Collection<String>) {
        if (paths.isEmpty()) {
            return
        }
        val stillNeeded = mutableSetOf<String>()
        manifestsDir().listFiles()?.forEach { manifest ->
            stillNeeded.addAll(manifest.readLines().filter { it.isNotBlank() })
        }
        val tilesDir = tilesDir()
        for (path in paths) {
            if (stillNeeded.contains(path)) {
                continue
            }
            val file = File(tilesDir, path)
            file.delete()
            deleteEmptyParents(file.parentFile, tilesDir)
        }
        if (tilesDir.list()?.isEmpty() == true) {
            tilesDir.delete()
        }
    }

    private fun deleteEmptyParents(directory: File?, tilesDir: File) {
        var current = directory
        while (current != null && current != tilesDir && current.isDirectory && current.list()?.isEmpty() == true) {
            if (!current.delete()) {
                return
            }
            current = current.parentFile
        }
    }

    private fun readManifest(tileKey: String): List<String> {
        val manifest = manifestFile(tileKey)
        return if (manifest.exists()) manifest.readLines().filter { it.isNotBlank() } else emptyList()
    }

    private fun writeManifest(tileKey: String, paths: List<String>) {
        manifestsDir().mkdirs()
        manifestFile(tileKey).writeText(paths.joinToString("\n"))
    }
}
