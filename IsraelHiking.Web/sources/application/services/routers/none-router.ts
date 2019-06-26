import { LatLngAlt, RouteSegmentData } from "../../models/models";

export class NoneRouter {

    public getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt): Promise<RouteSegmentData[]> {
        return new Promise<RouteSegmentData[]>((resolve) => {
            let emptyReturn = [] as RouteSegmentData[];
            latlngStart.alt = 0;
            latlngEnd.alt = 0;
            emptyReturn.push({
                routePoint: latlngEnd,
                latlngs: [latlngStart, latlngEnd],
                routingType: "None"
            } as RouteSegmentData);
            resolve(emptyReturn);
        });
    }
}
