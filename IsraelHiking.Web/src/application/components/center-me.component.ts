import { Component, inject, computed } from "@angular/core";

import { MatButton } from "@angular/material/button";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ResourcesService } from "../services/resources.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models";

@Component({
    selector: "center-me",
    templateUrl: "./center-me.component.html",
    imports: [MatButton, AnalyticsDirective]
})
export class CenterMeComponent {

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

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

    public centerMe() {
        this.store.dispatch(new SetPannedAction(null));
    }
}
