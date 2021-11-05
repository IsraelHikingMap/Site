import type { RoutingType } from "./models";

export type RouteEditingState = {
    routingType: RoutingType;
    selectedRouteId: string;
    recordingRouteId: string;
    opacity: number;
    weight: number;
};
