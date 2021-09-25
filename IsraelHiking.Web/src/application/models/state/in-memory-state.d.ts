import { ShareUrl } from "../models";

/**
 * this state should be clean every time the app starts
 */
export interface InMemoryState {
    distance: boolean;
    pannedTimestamp: Date;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
}
