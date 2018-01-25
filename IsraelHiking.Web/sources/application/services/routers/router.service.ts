import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as L from "leaflet";

import { ResourcesService } from "../resources.service";
import { ToastService } from "../toast.service";
import { NoneRouter } from "./none-router";
import { GeoJsonParser } from "../geojson.parser";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";
import "rxjs/add/operator/timeout";
import "rxjs/add/operator/toPromise";

@Injectable()
export class RouterService {
    private noneRouter: NoneRouter;

    constructor(private httpClient: HttpClient,
        private resourcesService: ResourcesService,
        private geoJsonParser: GeoJsonParser,
        private toastService: ToastService,
    ) {
        this.noneRouter = new NoneRouter();
    }

    public async getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng, routinType: Common.RoutingType): Promise<Common.RouteSegmentData[]> {
        var address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng + "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            let geojson = await this.httpClient.get(address).timeout(4500).toPromise();
            let data = this.geoJsonParser.toDataContainer(geojson as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>, this.resourcesService.getCurrentLanguageCodeSimplified());
            if (!data || data.routes.length === 0 || data.routes[0].segments.length < 2) {
                throw new Error("Empty data");
            } else {
                return data.routes[0].segments;
            }
        }
        catch (ex) {
            let coordinatesString = ` (${latlngStart.lat.toFixed(3)}°, ${latlngStart.lng.toFixed(3)}°) - (${latlngEnd.lat.toFixed(3)}°, ${latlngEnd.lng.toFixed(3)}°)`;
            this.toastService.error(this.resourcesService.routingFailed + coordinatesString);
            return await this.noneRouter.getRoute(latlngStart, latlngEnd);
        }
    }
}  