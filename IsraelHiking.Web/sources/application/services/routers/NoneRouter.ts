import * as Common from "../../common/IsraelHiking";

export class NoneRouter {
    constructor() { }

    public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): Promise<Common.RouteSegmentData[]> {
        return new Promise<Common.RouteSegmentData[]>(() => {
            var emptyReturn = [] as Common.RouteSegmentData[];
            latlngStart.alt = 0;
            latlngEnd.alt = 0;
            emptyReturn.push({
                routePoint: latlngEnd,
                latlngs: [latlngStart, latlngEnd],
                routingType: "None"
            } as Common.RouteSegmentData);
            return emptyReturn;
        });
        
    }
} 