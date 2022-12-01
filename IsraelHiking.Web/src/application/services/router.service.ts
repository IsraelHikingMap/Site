import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { Urls } from "../urls";
import type { LatLngAlt, RoutingType } from "../models/models";

@Injectable()
export class RouterService {
    constructor(private readonly httpClient: HttpClient,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService) { }

    public async getRoute(latlngStart: LatLngAlt, latlngEnd: LatLngAlt, routinType: RoutingType): Promise<LatLngAlt[]> {
        let address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            let geojson = await firstValueFrom(this.httpClient.get(address).pipe(timeout(4500)));
            let data = geojson as GeoJSON.FeatureCollection<GeoJSON.LineString>;
            return data.features[0].geometry.coordinates.map(c => SpatialService.toLatLng(c));
        } catch (ex) {
            let coordinatesString = ` (${latlngStart.lat.toFixed(3)}°, ${latlngStart.lng.toFixed(3)}°)` +
                ` - (${latlngEnd.lat.toFixed(3)}°, ${latlngEnd.lng.toFixed(3)}°)`;
            this.toastService.error(ex, this.resources.routingFailed + coordinatesString);
            return [latlngStart, latlngEnd];
        }
    }
}
