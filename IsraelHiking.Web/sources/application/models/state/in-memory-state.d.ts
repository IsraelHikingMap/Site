import { ShareUrl } from "../models";

/**
 * this state should be clean every time the app starts
 */
export interface InMemoryState {
    download: boolean;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
}