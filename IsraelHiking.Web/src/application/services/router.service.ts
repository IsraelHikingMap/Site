import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../urls";
import { LatLngAlt, RoutingType, RouteSegmentData } from "../models/models";

@Injectable()
export class RouterService {
    constructor(private readonly httpClient: HttpClient,
                private readonly resources: ResourcesService,
                private readonly geoJsonParser: GeoJsonParser,
                private readonly toastService: ToastService) { }

    public async getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<RouteSegmentData[]> {
        let address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            let geojson = await this.httpClient.get(address).pipe(timeout(4500)).toPromise();
            let data = this.geoJsonParser.toDataContainer(geojson as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>,
                this.resources.getCurrentLanguageCodeSimplified());
            if (!data || data.routes.length === 0 || data.routes[0].segments.length < 2) {
                throw new Error("Empty data");
            } else {
                return data.routes[0].segments;
            }
        } catch (ex) {
            let coordinatesString = ` (${latlngStart.lat.toFixed(3)}°, ${latlngStart.lng.toFixed(3)}°)` +
                ` - (${latlngEnd.lat.toFixed(3)}°, ${latlngEnd.lng.toFixed(3)}°)`;
            this.toastService.error(ex, this.resources.routingFailed + coordinatesString);
            return this.getEmptyRoute(latlngStart, latlngEnd);
        }
    }

    private getEmptyRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt): RouteSegmentData[] {
        let emptyReturn = [] as RouteSegmentData[];
        latlngStart.alt = 0;
        latlngEnd.alt = 0;
        emptyReturn.push({
            routePoint: latlngEnd,
            latlngs: [latlngStart, latlngEnd],
            routingType: "None"
        } as RouteSegmentData);
        return emptyReturn;
    }
}
