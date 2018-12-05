import { RouteSegmentData, MarkerData } from "./models";

export type RouteStateName = "Poi" | "Route" | "ReadOnly" | "Hidden";

export interface RouteData {
    id: string;
    name: string;
    description: string;
    color?: string;
    opacity?: number;
    weight?: number;
    state: RouteStateName;
    isRecording?: boolean;
    markers: MarkerData[];
    segments: RouteSegmentData[];
}