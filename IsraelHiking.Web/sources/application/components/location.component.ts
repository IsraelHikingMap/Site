import { Component } from "@angular/core";
import { LocalStorage } from "ngx-store";
import { first } from "rxjs/operators";
import { NgRedux } from "@angular-redux/store";
import { MapComponent } from "ngx-openlayers";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { RoutesService } from "../services/layers/routelayers/routes.service";
import { RouteLayerFactory } from "../services/layers/routelayers/route-layer.factory";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { SetLocationAction } from "../reducres/location.reducer";
import { IRouteLayer, IRouteSegment } from "../services/layers/routelayers/iroute.layer";
import { RouteData, ICoordinate, ApplicationState } from "../models/models";
import { DragInteraction } from "./intercations/drag.interaction";

interface ILocationInfo extends ICoordinate {
    radius: number;
}

@Component({
    selector: "location",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.scss"]
})
export class LocationComponent extends BaseMapComponent {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;

    @LocalStorage()
    private lastRecordedRoute: RouteData = null;

    @LocalStorage()
    private showBatteryConfirmation = true;

    private routeLayer: IRouteLayer;

    public locationCoordinate: ILocationInfo;
    public isFollowing: boolean;

    constructor(resources: ResourcesService,
        private readonly geoLocationService: GeoLocationService,
        private readonly toastService: ToastService,
        private readonly routesService: RoutesService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly ngRedux: NgRedux<ApplicationState>,
        host: MapComponent) {
        super(resources);

        this.locationCoordinate = null;
        this.routeLayer = null;
        this.isFollowing = true;

        host.instance.addInteraction(new DragInteraction(() => {
            if (!this.isActive()) {
                return;
            }
            this.isFollowing = false;
            this.cancelableTimeoutService.clearTimeoutByGroup("following");
            this.cancelableTimeoutService.setTimeoutByGroup(() => {
                if (this.locationCoordinate != null) {
                    this.setLocation();
                }
                this.isFollowing = true;
            }, LocationComponent.NOT_FOLLOWING_TIMEOUT, "following");
        }) as any);

        this.geoLocationService.positionChanged.subscribe(
            (position) => {
                if (position == null) {
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                } else {
                    this.updateMarkerPosition(position);
                    if (this.routeLayer != null && this.routeLayer.route.properties.isRecording) {
                        this.lastRecordedRoute = this.routeLayer.getData();
                    }
                }
            });
        if (this.lastRecordedRoute != null) {
            this.resources.languageChanged.pipe(first()).toPromise().then(() => {
                // let resources service get the strings
                this.toastService.confirm({
                    message: this.resources.continueRecording,
                    type: "YesNo",
                    confirmAction: () => {
                        this.toggleTracking();
                        this.routesService.setData([this.lastRecordedRoute]);
                        this.routeLayer = this.routesService.selectedRoute;
                        this.routeLayer.route.properties.isRecording = true;
                        this.routeLayer.setReadOnlyState();
                        this.routeLayer.raiseDataChanged();
                    },
                    declineAction: () => {
                        this.routesService.addRouteToLocalStorage(this.lastRecordedRoute);
                        this.lastRecordedRoute = null;
                    },
                });
            });
        }
    }

    public toggleTracking() {
        if (this.isLoading()) {
            this.disableGeoLocation();
        }
        if (this.isActive() && this.isFollowing) {
            this.disableGeoLocation();
        } else if (!this.isActive()) {
            this.geoLocationService.enable();
            this.isFollowing = true;
        } else if (this.isActive() && !this.isFollowing) {
            this.setLocation();
            this.isFollowing = true;
        }
    }

    public canRecord() {
        return this.geoLocationService.canRecord();
    }

    public isRecording() {
        return this.routeLayer != null;
    }

    public toggleRecording() {
        if (!this.isRecording()) {
            if (this.showBatteryConfirmation) {
                this.toastService.confirm({
                    message: this.resources.makeSureBatteryOptimizationIsOff,
                    type: "Custom",
                    declineAction: () => {
                        this.showBatteryConfirmation = false;
                    },
                    customConfirmText: this.resources.ok,
                    customDeclineText: this.resources.dontShowThisMessageAgain
                });
            }
            this.createRecordingRoute();
        } else {
            this.routeLayer.route.properties.isRecording = false;
            this.routeLayer.setReadOnlyState();
            this.routesService.addRouteToLocalStorage(this.routeLayer.getData());
            this.routeLayer = null;
            this.lastRecordedRoute = null;
        }
    }

    private createRecordingRoute() {
        let date = new Date();
        let name = this.resources.route + " " + date.toISOString().split("T")[0];
        if (!this.routesService.isNameAvailable(name)) {
            let dateString =
                `${date.toISOString().split("T")[0]} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
            name = this.resources.route + " " + dateString;
        }
        let route = this.routeLayerFactory.createRoute(name);
        route.properties.isRecording = true;
        let latlngs = [];
        let routePoint = null;
        let currentLocation = this.geoLocationService.currentLocation;
        if (currentLocation != null) {
            latlngs = [currentLocation];
            routePoint = currentLocation;
        }
        route.segments.push({
            latlngs: latlngs,
            routePoint: routePoint,
            routingType: "Hike",
            polyline: null,
            routePointMarker: null
        } as IRouteSegment);
        this.routesService.addRoute(route);
        this.routeLayer = this.routesService.selectedRoute;
        this.routeLayer.setReadOnlyState();
    }

    public isDisabled() {
        return this.geoLocationService.getState() === "disabled";
    }

    public isActive() {
        return this.geoLocationService.getState() === "tracking";
    }

    public isLoading() {
        return this.geoLocationService.getState() === "searching";
    }

    private updateMarkerPosition(position: Position) {
        if (this.locationCoordinate == null) {
            this.locationCoordinate = {} as ILocationInfo;
            this.isFollowing = true;
        }
        this.locationCoordinate.x = position.coords.longitude;
        this.locationCoordinate.y = position.coords.latitude;
        this.locationCoordinate.radius = position.coords.accuracy;
        if (this.isFollowing) {
            this.setLocation();
        }
        // HM TODO: accuracy circle? color: #136AEC, fill: #136AE
    }

    private disableGeoLocation() {
        if (this.isRecording()) {
            this.toggleRecording();
        }
        this.geoLocationService.disable();
        if (this.locationCoordinate != null) {
            this.locationCoordinate = null;
        }
    }

    private setLocation() {
        this.ngRedux.dispatch(new SetLocationAction({
            longitude: this.locationCoordinate.x,
            latitude: this.locationCoordinate.y
        }));
    }
}