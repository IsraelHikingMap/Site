import type { ShareUrl, PublicRoutesFilter, Theme, FileNameDateVersion } from "..";

/**
 * this state should be clean every time the app starts
 */
export type InMemoryState = {
    /**
     * The theme that is actually applied - the configured theme with "auto" already resolved to light or dark.
     */
    effectiveTheme: Theme;
    /**
     * The offline files that are on the device, keyed by the id of the tile they belong to.
     * They are read from the device when the app starts, so they are never out of sync with it,
     * and empty until they were read, which is also what an empty device looks like.
     */
    downloadedTiles: Record<string, FileNameDateVersion[]>;
    distance: boolean;
    pannedTimestamp: Date;
    following: boolean;
    keepNorthUp: boolean;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
    searchTerm: string;
    currentUrl: string;
    publicRoutesFilter: PublicRoutesFilter;
};
