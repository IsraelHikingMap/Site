import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";

import { RouteStrings } from "../services/hash.service";
import { RunningContextService } from "./running-context.service";

declare var universalLinks: any;

@Injectable()
export class DeepLinksService {
    constructor(private readonly router: Router,
        private readonly runningContextService: RunningContextService,
        private readonly ngZone: NgZone) { }

    public initialize() {
        if (!this.runningContextService.isCordova) {
            return;
        }
        universalLinks.subscribe("share", (event) => {
            let shareId = event.path.replace("/share/", "");
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_SHARE, shareId]);
            });
        });
        universalLinks.subscribe("poi", (event) => {
            let sourceAndId = event.path.replace("/poi/", "");
            let source = sourceAndId.split("/")[0];
            let id = sourceAndId.split("/")[1];
            let language = event.params.language;
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_POI, source, id],
                    { queryParams: { language: language } });
            });
        });
        universalLinks.subscribe("url", (event) => {
            let url = event.path.replace("/url/", "");
            let baseLayer = event.params.baselayer;
            this.ngZone.run(() => {
                this.router.navigate([RouteStrings.ROUTE_URL, url],
                    { queryParams: { baseLayer: baseLayer } });
            });
        });
    }
}