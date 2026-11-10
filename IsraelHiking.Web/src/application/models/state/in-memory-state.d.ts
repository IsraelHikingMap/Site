import type { ShareUrl, PublicRoutesFilter, Theme, DownloadedArea } from "..";

/**
 * this state should be clean every time the app starts
 */
export type InMemoryState = {
    /**
     * The theme that is actually applied - the configured theme with "auto" already resolved to light or dark.
     */
    effectiveTheme: Theme;
    /**
     * What is downloaded for offline usage, keyed by the id of the area. It is read from the device, the files, the
     * files the areas are kept in and the routing plugin, so it is never out of sync with it, and empty until it was
     * read, which is also what an empty device looks like.
     */
    downloadedAreas: Record<string, DownloadedArea>;
    distance: boolean;
    pannedTimestamp: Date;
    following: boolean;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
    searchTerm: string;
    currentUrl: string;
    publicRoutesFilter: PublicRoutesFilter;
};
