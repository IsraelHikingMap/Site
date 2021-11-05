import type { LatLngAlt, LatLngAltTime } from "./models";

export type RoutingType = "Hike" | "Bike" | "4WD" | "None";

export type RouteSegmentData = {
    routePoint: LatLngAlt;
    latlngs: LatLngAltTime[];
    routingType: RoutingType;
};
