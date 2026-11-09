import { InjectionToken } from "@angular/core";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** Where a tile download got to, "none" when there is no download of that tile */
export type TileDownloadState = "running" | "completed" | "failed" | "cancelled" | "none";

/** A file that is missing after its retries, the reason is an HTTP status, a network error, a timeout or a full disk */
export type FailedTileFile = { fileName: string; reason: string };

/**
 * The native background download plugin, see android/.../com/mapeak/offline/OfflineDownloadPlugin.kt.
 * It downloads the files of one tile as a single job that goes on while the app is in the background,
 * and writes them to "offline-files" in the cache directory, where the app reads them from.
 * This file is the boundary of that plugin, like valhalla.plugin.ts is of the routing one.
 */
export interface OfflineDownloadPlugin {
    /**
     * Saves the download of a tile and queues it, resolving once it was. The files are downloaded in the given
     * order, a few at a time, and a download of another tile that is going on is cancelled first.
     */
    startTileDownload(options: {
        tileKey: string;
        files: { fileName: string; url: string }[];
        headers: Record<string, string>;
        concurrency: number;
        /**
         * The URI of the offline files cache, where the app reads the files from. iOS writes the files there, and
         * android writes them to "offline-files" in its cache directory, which is the same directory.
         */
        directory: string;
    }): Promise<void>;
    /** Stops the transfers of a tile and deletes its partial files, the files that completed are kept */
    cancelTileDownload(options: { tileKey: string }): Promise<void>;
    /**
     * The download of a tile as it stands. This is what tells how a download ended when the app was not
     * there to hear it, and a download whose process was killed is continued when it is asked about.
     */
    getTileDownload(options: { tileKey: string }): Promise<{ state: TileDownloadState; completedFiles: string[]; failedFiles: FailedTileFile[] }>;
    addListener(eventName: "fileProgress",
        listener: (event: { tileKey: string; fileName: string; fraction: number }) => void): Promise<PluginListenerHandle>;
    addListener(eventName: "fileCompleted",
        listener: (event: { tileKey: string; fileName: string }) => void): Promise<PluginListenerHandle>;
    addListener(eventName: "tileFinished",
        listener: (event: { tileKey: string; state: TileDownloadState; failedFiles: FailedTileFile[] }) => void): Promise<PluginListenerHandle>;
}

export const OfflineDownload = registerPlugin<OfflineDownloadPlugin>("OfflineDownload");

/**
 * The plugin where it is registered, and null on the platforms it was not written for, where the files are
 * downloaded with fetch. It is injected rather than imported, so that a test can hand the app a stand-in for it.
 */
export const OFFLINE_DOWNLOAD = new InjectionToken<OfflineDownloadPlugin | null>("OFFLINE_DOWNLOAD", {
    providedIn: "root",
    factory: () => Capacitor.isPluginAvailable("OfflineDownload") ? OfflineDownload : null
});
