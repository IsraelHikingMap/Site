export declare type TrackingStateType = "disabled" | "searching" | "tracking";

export type GpsState = {
    tracking: TrackingStateType;
    currentPosition: GeolocationPosition;
};
