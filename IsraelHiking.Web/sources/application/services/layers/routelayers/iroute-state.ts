export type RouteStateName = "Poi" | "Route" | "ReadOnly" | "Hidden" | "Recording" | "RecordingPoi";

export interface IRouteState {
    reRoute: () => void;
    initialize(): void;
    clear(): void;
    getStateName(): RouteStateName;
}