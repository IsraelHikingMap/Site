import { LatLngAlt, ILatLngTime } from "./models";

export type RoutingType = "Hike" | "Bike" | "4WD" | "None";

export interface RouteSegmentData {
    routePoint: LatLngAlt;
    latlngs: ILatLngTime[];
    routingType: RoutingType;
}