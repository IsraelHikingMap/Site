import { Component, OnInit, OnDestroy } from "@angular/core";

import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { NgRedux } from "@angular-redux2/store";

import { RouteStrings } from "../services/hash.service";
import { SidebarService } from "../services/sidebar.service";
import { DataContainerService } from "../services/data-container.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { SetFileUrlAndBaseLayerAction, SetShareUrlAction } from "../reducers/in-memory.reducer";
import type { ApplicationState } from "../models/models";

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
                private readonly ngRedux: NgRedux<ApplicationState>) {
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
                this.ngRedux.dispatch(new SetFileUrlAndBaseLayerAction({ fileUrl: null, baseLayer: null }));
                this.ngRedux.dispatch(new SetShareUrlAction({ shareUrl: null }));
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
