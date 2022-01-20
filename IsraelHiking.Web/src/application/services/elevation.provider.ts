import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { LoggingService } from "./logging.service";
import { Urls } from "../urls";
import type { LatLngAlt } from "../models/models";

@Injectable()
export class ElevationProvider {

    constructor(private readonly httpClient: HttpClient,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService,
                private readonly loggingService: LoggingService) { }

    public async updateHeights(latlngs: LatLngAlt[]): Promise<LatLngAlt[]> {
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
            let response = await firstValueFrom(this.httpClient.get(Urls.elevation, { params }).pipe(timeout(1000)));
            for (let index = 0; index < relevantIndexes.length; index++) {
                latlngs[relevantIndexes[index]].alt = (response as number[])[index];
            }
        } catch (ex) {
            this.loggingService.warning(`Unable to get elevation data for ${latlngs.length} points. ` + (ex as Error).message);
            this.toastService.warning(this.resources.unableToGetElevationData);
        }
        return latlngs;
    }
}
