import type { ShareUrl } from "../models";

/**
 * this state should be clean every time the app starts
 */
export type InMemoryState = {
    distance: boolean;
    pannedTimestamp: Date;
    following: boolean;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
};
