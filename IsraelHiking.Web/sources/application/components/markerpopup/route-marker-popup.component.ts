import { Component, Input, HostListener, OnInit, OnChanges } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { DELETE } from "@angular/cdk/keycodes";

import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";

@Component({
    selector: "route-marker-popup",
    templateUrl: "./route-marker-popup.component.html"
})
export class RouteMarkerPopupComponent extends BaseMarkerPopupComponent implements OnChanges {
    public canMerge: boolean;
    public isMiddle: boolean;

    @Input()
    private segmentIndex: number;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider,
        private readonly selectedRouteService: SelectedRouteService) {
        super(resources, httpClient, elevationProvider);
        this.canMerge = false;
        this.isMiddle = false;
    }

    public ngOnChanges(): void {
        this.isMiddle = this.isFirst() === false && this.isLast() === false;
        if (this.isMiddle) {
            this.canMerge = false;
            return;
        }
        this.canMerge = this.selectedRouteService.getClosestRoute(this.isFirst()) != null;
    }

    public split(): void {
        this.selectedRouteService.splitRoute(this.segmentIndex);
        this.close();
    }

    public merge() {
        this.selectedRouteService.mergeRoutes(this.isFirst());
        this.close();
    }

    public reverse() {
        this.selectedRouteService.reverseRoute();
        this.close();
    }

    public remove = () => {
        this.selectedRouteService.removeSegment(this.segmentIndex);
        this.close();
    }

    private isFirst(): boolean {
        return this.segmentIndex === 0;
    }

    private isLast(): boolean {
        return this.selectedRouteService.getSelectedRoute().segments.length - 1 === this.segmentIndex;
    }

    @HostListener("window:keydown", ["$event"])
    public onEnterPress($event: KeyboardEvent) {
        if ($event.keyCode !== DELETE) {
            return true;
        }
        this.remove();
        return false;
    }
}