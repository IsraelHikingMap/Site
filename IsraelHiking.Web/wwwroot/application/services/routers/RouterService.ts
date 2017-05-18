import { Injectable } from "@angular/core";
import { Http, RequestOptionsArgs } from "@angular/http";
import { ResourcesService } from "../ResourcesService";
import { ToastService } from "../ToastService";
import { NoneRouter } from "./NoneRouter";
import { GeoJsonParser } from "../GeoJsonParser";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";
import "rxjs/add/operator/timeout";
import "rxjs/add/operator/toPromise";

@Injectable()
export class RouterService {
    private noneRouter: NoneRouter

    constructor(private http: Http,
        private resourcesService: ResourcesService,
        private geoJsonParser: GeoJsonParser,
        private toastService: ToastService,
    ) {
        this.noneRouter = new NoneRouter();
    }

    public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng, routinType: Common.RoutingType): Promise<Common.RouteSegmentData[]> {
        var address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng + "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        return new Promise((resolve, reject) => {
            this.http.get(address).timeout(4500).toPromise()
                .then((geojson) => {
                    var failed = false;
                    let data = null;
                    try {
                        data = this.geoJsonParser.toDataContainer(geojson.json());
                    } catch (err) {
                        failed = true;
                    }
                    if (failed || !data || data.routes.length === 0 || data.routes[0].segments.length < 2) {
                        this.toastService.error(this.resourcesService.routingFailed + ` ${latlngStart} => ${latlngEnd}`);
                        this.noneRouter.getRoute(latlngStart, latlngEnd).then((noneRouterData) => {
                            resolve(noneRouterData);
                        });
                    } else {
                        resolve(data.routes[0].segments);
                    }
                }, () => {
                    this.toastService.error(this.resourcesService.routingFailed + ` ${latlngStart} => ${latlngEnd}`);
                    this.noneRouter.getRoute(latlngStart, latlngEnd).then((data) => {
                        resolve(data);
                    });
                });
        });
    }
}  