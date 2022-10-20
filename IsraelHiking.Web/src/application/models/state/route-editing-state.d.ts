import type { RoutingType } from "../models";

export type RouteEditingState = {
    routingType: RoutingType;
    selectedRouteId: string;
    opacity: number;
    weight: number;
};
