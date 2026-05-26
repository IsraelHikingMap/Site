package com.mapeak.car;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.GZIPInputStream;

import ch.poole.geo.pmtiles.Reader;

public class PmTilesService implements AutoCloseable {

    public static final int TILES_ZOOM = 7;

    private static final byte COMPRESSION_NONE = 1;
    private static final byte COMPRESSION_GZIP = 2;

    private final File baseDir;
    private final Map<String, Reader> readerCache = new HashMap<>();

    public PmTilesService(@NonNull Context context) {
        this.baseDir = context.getFilesDir();
    }

    /**
     * Gets a tile from the stored pmtiles file.
     *
     * @param url should be something like
     *            custom://filename-without-pmtiles-extension/{z}/{x}/{y}.png
     */
    public byte[] getTileByUrl(@NonNull String url) throws IOException {
        String[] parts = url.split("/");
        String fileName = parts[2] + ".pmtiles";
        int z = Integer.parseInt(parts[parts.length - 3]);
        int x = Integer.parseInt(parts[parts.length - 2]);
        int y = Integer.parseInt(parts[parts.length - 1].split("\\.")[0]);
        return getTileFromFile(fileName, z, x, y);
    }

    public byte[] getTileByType(int z, int x, int y, @NonNull String type) throws IOException {
        return getTileFromFile(getFileNameByType(z, x, y, type), z, x, y);
    }

    public boolean isOfflineFileAvailable(int z, int x, int y, @NonNull String type) {
        return new File(baseDir, getFileNameByType(z, x, y, type)).exists();
    }

    @Nullable
    public String getVersion(@NonNull String fileName) throws IOException {
        Reader reader = getReader(fileName);
        String metadata;
        synchronized (reader) {
            metadata = reader.getMetadata();
        }
        if (metadata == null) {
            return null;
        }
        try {
            return new JSONObject(metadata).optString("version", null);
        } catch (JSONException ex) {
            throw new IOException("Failed to parse metadata of " + fileName, ex);
        }
    }

    @Override
    public synchronized void close() {
        for (Reader reader : readerCache.values()) {
            try {
                reader.close();
            } catch (Exception ignored) {
            }
        }
        readerCache.clear();
    }

    private String getFileNameByType(int z, int x, int y, @NonNull String type) {
        if (z >= TILES_ZOOM) {
            int scale = 1 << (z - TILES_ZOOM);
            int tileX = x / scale;
            int tileY = y / scale;
            return type + "+" + TILES_ZOOM + "-" + tileX + "-" + tileY + ".pmtiles";
        }
        return type + "-" + (TILES_ZOOM - 1) + ".pmtiles";
    }

    private byte[] getTileFromFile(String fileName, int z, int x, int y) throws IOException {
        Reader reader = getReader(fileName);
        byte[] data;
        byte compression;
        synchronized (reader) {
            data = reader.getTile(z, x, y);
            compression = reader.getTileCompression();
        }
        if (data == null) {
            throw new IOException("Response is null for tile " + z + "/" + x + "/" + y + " from file " + fileName);
        }
        return decompress(data, compression, fileName);
    }

    private synchronized Reader getReader(String fileName) throws IOException {
        Reader cached = readerCache.get(fileName);
        if (cached != null) {
            return cached;
        }
        File file = new File(baseDir, fileName);
        if (!file.exists()) {
            throw new IOException("PMTiles file not found: " + file.getAbsolutePath());
        }
        Reader reader = new Reader(file);
        readerCache.put(fileName, reader);
        return reader;
    }

    private static byte[] decompress(byte[] data, byte compression, String fileName) throws IOException {
        if (compression == COMPRESSION_NONE) {
            return data;
        }
        if (compression == COMPRESSION_GZIP) {
            try (GZIPInputStream gzip = new GZIPInputStream(new java.io.ByteArrayInputStream(data))) {
                ByteArrayOutputStream out = new ByteArrayOutputStream(data.length * 2);
                byte[] buffer = new byte[8192];
                int read;
                while ((read = gzip.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
                return out.toByteArray();
            }
        }
        throw new IOException("Unsupported PMTiles tile compression " + compression + " in " + fileName);
    }
}
