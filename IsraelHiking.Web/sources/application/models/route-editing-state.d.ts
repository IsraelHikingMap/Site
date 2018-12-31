import { RoutingType } from "./models";

export interface RouteEditingState {
    routingType: RoutingType;
    selectedRouteId: string;
    recordingRouteId: string;
}