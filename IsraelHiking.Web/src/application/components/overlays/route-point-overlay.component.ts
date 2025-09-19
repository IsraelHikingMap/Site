import { Component, HostListener, OnChanges, inject, output, input } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";


import { CoordinatesComponent } from "../coordinates.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import type { LatLngAlt } from "../../models";

@Component({
    selector: "route-point-overlay",
    templateUrl: "./route-point-overlay.component.html",
    imports: [Dir, MatButton, MatTooltip, CoordinatesComponent]
})
export class RoutePointOverlayComponent implements OnChanges {
    public canMerge: boolean = false;
    public isMiddle: boolean = false;

    public latlng = input<LatLngAlt>();

    public segmentIndex = input<number>();

    public closed = output();

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
        this.selectedRouteService.splitRoute(this.segmentIndex());
        this.closed.emit();
    }

    public merge() {
        this.selectedRouteService.mergeRoutes(this.isFirst());
        this.closed.emit();
    }

    public reverse() {
        this.selectedRouteService.reverseRoute();
        this.closed.emit();
    }

    public remove() {
        this.selectedRouteService.removeSegment(this.segmentIndex());
        this.closed.emit();
    }

    private isFirst(): boolean {
        return this.segmentIndex() === 0;
    }

    private isLast(): boolean {
        return this.selectedRouteService.getSelectedRoute().segments.length - 1 === this.segmentIndex();
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
