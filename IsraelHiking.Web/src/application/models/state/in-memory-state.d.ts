import type { ShareUrl, PublicRoutesFilter, Theme } from "..";

/**
 * this state should be clean every time the app starts
 */
export type InMemoryState = {
    /**
     * The theme that is actually applied - the configured theme with "auto" already resolved to light or dark.
     */
    effectiveTheme: Theme;
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
