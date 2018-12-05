import { Component, Input, HostListener, OnChanges } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { ClosableOverlayComponent } from "./closable-overlay.component";

@Component({
    selector: "route-point-overlay",
    templateUrl: "./route-point-overlay.component.html"
})
export class RoutePointOverlayComponent extends ClosableOverlayComponent implements OnChanges {
    public canMerge: boolean;
    public isMiddle: boolean;

    @Input()
    private segmentIndex: number;

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService) {
        super(resources);
        this.canMerge = false;
        this.isMiddle = false;
        this.hideCoordinates = true;
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
        if ($event.key !== "Delete") {
            return true;
        }
        this.remove();
        return false;
    }
}