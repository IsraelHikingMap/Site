import { Component, Injector, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import * as _ from "lodash";
import { ResourcesService } from "../../services/resources.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { IRouteSegment } from "../../services/layers/routelayers/iroute.layer";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import * as Common from "../../common/IsraelHiking";

@Component({
    selector: "route-marker-popup",
    templateUrl: "./route-marker-popup.component.html"
})
export class RouteMarkerPopupComponent extends BaseMarkerPopupComponent {
    public canMerge: boolean;
    public isMiddle: boolean;
    private routeSegment: IRouteSegment;
    private routesService: RoutesService;
    
    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private injector: Injector,) {
        super(resources, http, applicationRef, elevationProvider);
        this.canMerge = false;
        this.isMiddle = false;
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.routesService = this.injector.get(RoutesService);
        this.setMarkerInternal(marker);
        marker.on("popupopen", () => {
            this.routeSegment = _.find(this.routesService.selectedRoute.route.segments, segmentToFind => this.marker === segmentToFind.routePointMarker);
            this.isMiddle = this.isFirst() === false && this.routesService.selectedRoute.getLastSegment() !== this.routeSegment;
            if (this.isMiddle) {
                this.canMerge = false;
                return;
            }
            this.canMerge = this.routesService.getClosestRoute(this.isFirst()) != null;
        });
    }
    
    public split(): void {
        this.routesService.splitSelectedRouteAt(this.routeSegment);
    }
    
    public merge() {
        this.routesService.mergeSelectedRouteToClosest(this.isFirst());
    }

    public reverse() {
        this.routesService.selectedRoute.reverse();
    }
    
    private isFirst(): boolean {
        return this.routesService.selectedRoute.route.segments[0] === this.routeSegment;
    }
}