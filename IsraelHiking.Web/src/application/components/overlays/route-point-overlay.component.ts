import { Component, Input, HostListener, OnChanges, Output, EventEmitter, inject } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import type { LatLngAlt } from "../../models/models";

@Component({
    selector: "route-point-overlay",
    templateUrl: "./route-point-overlay.component.html"
})
export class RoutePointOverlayComponent implements OnChanges {
    public canMerge: boolean = false;
    public isMiddle: boolean = false;

    @Input()
    public latlng: LatLngAlt;

    @Input()
    public segmentIndex: number;

    @Output()
    public closed = new EventEmitter();

    public hideCoordinates: boolean = true;

    public readonly resources = inject(ResourcesService);

    private readonly selectedRouteService = inject(SelectedRouteService);

    public ngOnChanges(): void {
        this.isMiddle = this.isFirst() === false && this.isLast() === false;
        if (this.isMiddle) {
            this.canMerge = false;
            return;
        }
        this.canMerge = this.selectedRouteService.getClosestRouteToSelected(this.isFirst()) != null;
    }

    public split(): void {
        this.selectedRouteService.splitRoute(this.segmentIndex);
        this.closed.next(undefined);
    }

    public merge() {
        this.selectedRouteService.mergeRoutes(this.isFirst());
        this.closed.next(undefined);
    }

    public reverse() {
        this.selectedRouteService.reverseRoute();
        this.closed.next(undefined);
    }

    public remove() {
        this.selectedRouteService.removeSegment(this.segmentIndex);
        this.closed.next(undefined);
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
