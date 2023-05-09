import { Component, OnInit, OnDestroy } from "@angular/core";

import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { Store } from "@ngxs/store";

import { RouteStrings } from "../services/hash.service";
import { SidebarService } from "../services/sidebar.service";
import { DataContainerService } from "../services/data-container.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { SetFileUrlAndBaseLayerAction, SetShareUrlAction } from "../reducers/in-memory.reducer";

@Component({
    selector: "application-state",
    template: "<div></div>"
})
export class ApplicationStateComponent implements OnInit, OnDestroy {

    private subscription: Subscription;

    constructor(private readonly router: Router,
                private readonly route: ActivatedRoute,
                private readonly sidebarService: SidebarService,
                private readonly dataContainerService: DataContainerService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly store: Store) {
        this.subscription = null;
    }

    public ngOnInit() {
        this.subscription = this.route.params.subscribe(params => {
            if (this.router.url.startsWith(RouteStrings.ROUTE_MAP)) {
                this.fitBoundsService.flyTo({
                    lng: +params[RouteStrings.LON],
                    lat: +params[RouteStrings.LAT]
                }, +params[RouteStrings.ZOOM] - 1);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_SHARE)) {
                this.dataContainerService.setShareUrlAfterNavigation(params[RouteStrings.ID]);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_URL)) {
                this.dataContainerService.setFileUrlAfterNavigation(params[RouteStrings.ID],
                    this.route.snapshot.queryParamMap.get(RouteStrings.BASE_LAYER));
            } else if (this.router.url === RouteStrings.ROUTE_ROOT) {
                this.store.dispatch(new SetFileUrlAndBaseLayerAction(null, null));
                this.store.dispatch(new SetShareUrlAction(null));
                this.sidebarService.hideWithoutChangingAddressbar();
            }
        });
    }

    public ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }
}
