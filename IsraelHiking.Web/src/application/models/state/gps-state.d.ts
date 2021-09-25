export declare type TrackingStateType = "disabled" | "searching" | "tracking";

export interface GpsState {
    tracking: TrackingStateType;
    currentPoistion: GeolocationPosition;
}
