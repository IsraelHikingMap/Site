import type { RoutingType } from "..";

export type RouteEditingState = {
    routingType: RoutingType;
    selectedRouteId: string;
    opacity: number;
    weight: number;
};
