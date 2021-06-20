import { ShareUrl } from "../models";

export declare type GeoLocationStateType = "disabled" | "searching" | "tracking";

/**
 * this state should be clean every time the app starts
 */
export interface InMemoryState {
    distance: boolean;
    pannedTimestamp: Date;
    baseLayer: string;
    fileUrl: string;
    shareUrl: ShareUrl;
    geoLocation: GeoLocationStateType;
}
