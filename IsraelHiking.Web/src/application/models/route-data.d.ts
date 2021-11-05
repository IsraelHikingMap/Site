import type { RouteSegmentData, MarkerData } from "./models";

export type RouteStateName = "Poi" | "Route" | "ReadOnly" | "Hidden";

export type RouteData = {
    id: string;
    name: string;
    description: string;
    color?: string;
    opacity?: number;
    weight?: number;
    state: RouteStateName;
    markers: MarkerData[];
    segments: RouteSegmentData[];
};
