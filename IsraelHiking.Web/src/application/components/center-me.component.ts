import { Component, inject, computed } from "@angular/core";

import { MatButton } from "@angular/material/button";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ResourcesService } from "../services/resources.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import { CENTER_ANIMATION_DURATION_MILLISECONDS, LocationService } from "../services/location.service";
import { MapService } from "../services/map.service";
import type { ApplicationState } from "../models";

@Component({
    selector: "center-me",
    templateUrl: "./center-me.component.html",
    imports: [MatButton, AnalyticsDirective]
})
export class CenterMeComponent {

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);
    private readonly locationService = inject(LocationService);
    private readonly mapService = inject(MapService);

    private readonly inMemoryState = this.store.selectSignal((s: ApplicationState) => s.inMemoryState);
    private readonly tracking = this.store.selectSignal((s: ApplicationState) => s.gpsState.tracking);
    private readonly isEditingRoute = this.store.selectSignal((s: ApplicationState) => {
        const selectedRoute = s.routes.present.find(r => r.id === s.routeEditingState.selectedRouteId);
        return selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route");
    });

    public readonly showButton = computed(() =>
        this.inMemoryState().pannedTimestamp != null &&
        this.inMemoryState().following &&
        this.tracking() === "tracking" &&
        !this.isEditingRoute());

    /** Keeps the map panned until it reaches the GPS position, so compass and GPS updates can not cut the move short. */
    public async centerMe() {
        const pannedTimestamp = this.inMemoryState().pannedTimestamp;
        await this.locationService.moveMapToGpsPosition(CENTER_ANIMATION_DURATION_MILLISECONDS);
        await this.mapService.waitForMoveEnd();
        if (this.inMemoryState().pannedTimestamp !== pannedTimestamp) {
            return;
        }
        this.store.dispatch(new SetPannedAction(null));
    }
}
