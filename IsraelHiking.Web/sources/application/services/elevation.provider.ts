import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { Urls } from "../common/Urls";

@Injectable()
export class ElevationProvider {

    constructor(private readonly httpClient: HttpClient,
        private readonly resourcesService: ResourcesService,
        private readonly toastService: ToastService,
    ) { }

    public updateHeights = async (latlngs: L.LatLng[]): Promise<L.LatLng[]> => {
        let relevantIndexes = [] as number[];
        let points = [] as string[];
        for (let i = 0; i < latlngs.length; i++) {
            let latlng = latlngs[i];
            if (latlng.alt) {
                continue;
            }
            relevantIndexes.push(i);
            points.push(`${latlng.lat.toFixed(4)},${latlng.lng.toFixed(4)}`);
        }
        if (relevantIndexes.length === 0) {
            return latlngs;
        }
        try {
            let params = new HttpParams().set("points", points.join("|"));
            let response = await this.httpClient.get(Urls.elevation, { params: params }).toPromise();
            for (let index = 0; index < relevantIndexes.length; index++) {
                latlngs[relevantIndexes[index]].alt = response[index];
            }
            return latlngs;
        } catch (ex) {
            this.toastService.error(this.resourcesService.unableToGetElevationData);
            throw ex;
        }
    }
}
