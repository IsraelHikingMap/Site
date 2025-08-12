import type { RouteSegmentData, MarkerData } from ".";

export type RouteEditStateType = "Poi" | "Route" | "ReadOnly" | "Hidden";

export type RouteData = {
    id: string;
    name: string;
    description: string;
    color?: string;
    opacity?: number;
    weight?: number;
    state: RouteEditStateType;
    markers: MarkerData[];
    segments: RouteSegmentData[];
};
