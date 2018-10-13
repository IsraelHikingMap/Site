﻿import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";

import { ResourcesService } from "../resources.service";
import { ToastService } from "../toast.service";
import { NoneRouter } from "./none-router";
import { GeoJsonParser } from "../geojson.parser";
import { Urls } from "../../urls";
import { LatLngAlt, RoutingType, RouteSegmentData } from "../../models/models";

@Injectable()
export class RouterService {
    private readonly noneRouter: NoneRouter;

    constructor(private readonly httpClient: HttpClient,
        private readonly resourcesService: ResourcesService,
        private readonly geoJsonParser: GeoJsonParser,
        private readonly toastService: ToastService,
    ) {
        this.noneRouter = new NoneRouter();
    }

    public async getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<RouteSegmentData[]> {
        let address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            let geojson = await this.httpClient.get(address).pipe(timeout(4500)).toPromise();
            let data = this.geoJsonParser.toDataContainer(geojson as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>,
                this.resourcesService.getCurrentLanguageCodeSimplified());
            if (!data || data.routes.length === 0 || data.routes[0].segments.length < 2) {
                throw new Error("Empty data");
            } else {
                return data.routes[0].segments;
            }
        } catch (ex) {
            let coordinatesString = ` (${latlngStart.lat.toFixed(3)}°, ${latlngStart.lng.toFixed(3)}°)` +
                ` - (${latlngEnd.lat.toFixed(3)}°, ${latlngEnd.lng.toFixed(3)}°)`;
            this.toastService.error(this.resourcesService.routingFailed + coordinatesString);
            return await this.noneRouter.getRoute(latlngStart, latlngEnd);
        }
    }
}