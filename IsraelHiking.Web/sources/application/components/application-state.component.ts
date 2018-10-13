import { Component, OnInit, OnDestroy, NgZone } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { NgRedux } from "@angular-redux/store";

import { HashService, RouteStrings, IPoiRouterData } from "../services/hash.service";
import { SidebarService } from "../services/sidebar.service";
import { DataContainerService } from "../services/data-container.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { ApplicationState } from "../models/models";
import { SetLocationAction } from "../reducres/location.reducer";

@Component({
    selector: "application-state",
    template: "<div></div>"
})
export class ApplicationStateComponent implements OnInit, OnDestroy {

    private subscription: Subscription;

    constructor(private readonly router: Router,
        private readonly route: ActivatedRoute,
        private readonly hashService: HashService,
        private readonly sidebarService: SidebarService,
        private readonly dataContainerService: DataContainerService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        this.subscription = null;
    }

    public ngOnInit() {
        this.subscription = this.route.params.subscribe(params => {
            if (this.router.url.startsWith(RouteStrings.ROUTE_MAP)) {
                if (!this.fitBoundsService.isFlying) {
                    this.ngRedux.dispatch(new SetLocationAction({
                        longitude: +params[RouteStrings.LON],
                        latitude: +params[RouteStrings.LAT],
                        zoom: +params[RouteStrings.ZOOM]
                    }));
                }
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_SEARCH)) {
                this.hashService.setApplicationState("search", decodeURIComponent(params[RouteStrings.TERM]));
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_SHARE)) {
                this.dataContainerService.setShareUrlAfterNavigation(params[RouteStrings.ID]);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_URL)) {
                this.dataContainerService.setFileUrlAfterNavigation(params[RouteStrings.ID],
                    this.route.snapshot.queryParamMap.get(RouteStrings.BASE_LAYER));
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_DOWNLOAD)) {
                this.hashService.setApplicationState("download", true);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_POI)) {
                let snapshotMap = this.route.snapshot.queryParamMap;
                let poiSourceAndId = {
                    id: params[RouteStrings.ID],
                    source: params[RouteStrings.SOURCE],
                    language: snapshotMap.get(RouteStrings.LANGUAGE)
                } as IPoiRouterData;
                let previousData = this.hashService.getPoiRouterData();
                if (previousData != null &&
                    previousData.id !== poiSourceAndId.id) {
                    this.sidebarService.hideWithoutChangingAddressbar();
                }
                if (previousData == null && this.sidebarService.isVisible) {
                    this.sidebarService.toggle("public-poi");
                }
                this.hashService.setApplicationState("poi", poiSourceAndId);
                if (!this.sidebarService.isVisible) {
                    setTimeout(() => this.sidebarService.toggle("public-poi"), 0);
                }
            } else if (this.router.url === RouteStrings.ROUTE_ROOT) {
                this.hashService.setApplicationState("poi", null);
                this.hashService.setApplicationState("url", null);
                this.hashService.setApplicationState("share", null);
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