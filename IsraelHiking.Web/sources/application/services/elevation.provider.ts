import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { Urls } from "../common/Urls";
import "rxjs/add/operator/toPromise";

@Injectable()
export class ElevationProvider {

    constructor(private http: Http,
        private resourcesService: ResourcesService,
        private toastService: ToastService,
    ) { }

    public updateHeights = (latlngs: L.LatLng[]): Promise<L.LatLng[]> => {
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
            return new Promise((resolve) => { resolve(latlngs); });
        }
        return new Promise((resolve, reject) => {
            this.http.get(Urls.elevation, { params: { points: points.join("|") } }).toPromise().then((response) => {
                for (let index = 0; index < relevantIndexes.length; index++) {
                    latlngs[relevantIndexes[index]].alt = response.json()[index];
                }
                resolve(latlngs);
            }, (err) => {
                this.toastService.error(this.resourcesService.unableToGetElevationData);
                reject(err);
            });
        });
    }
}
