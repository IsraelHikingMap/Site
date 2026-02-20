import type { ShareUrl } from "..";

/**
 * this state should be clean every time the app starts
 */
export type InMemoryState = {
    distance: boolean;
    pannedTimestamp: Date;
    following: boolean;
    keepNorthUp: boolean;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
    searchTerm: string;
};
