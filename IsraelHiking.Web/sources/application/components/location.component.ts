import { Component } from "@angular/core";
import { LocalStorage } from "ngx-store";
import { first } from "rxjs/operators";
import { NgRedux } from "@angular-redux/store";
import { MapComponent } from "ngx-openlayers";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { RouteLayerFactory } from "../services/layers/routelayers/route-layer.factory";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { SetLocationAction } from "../reducres/location.reducer";
import { RouteData, ICoordinate, ApplicationState } from "../models/models";
import { DragInteraction } from "./intercations/drag.interaction";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { AddRouteAction, StopRecordingAction } from "../reducres/routes.reducer";
import { SetSelectedRouteAction } from "../reducres/route-editing-state.reducer";
import { AddLocallyRecordedRouteAction } from "../reducres/locally-recorded-routes.reducer";

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

    private recordingRouteId: string;

    public locationCoordinate: ILocationInfo;
    public isFollowing: boolean;

    constructor(resources: ResourcesService,
        private readonly geoLocationService: GeoLocationService,
        private readonly toastService: ToastService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly ngRedux: NgRedux<ApplicationState>,
        private readonly host: MapComponent) {
        super(resources);

        this.locationCoordinate = null;
        this.recordingRouteId = null;
        this.isFollowing = true;

        this.host.instance.addInteraction(new DragInteraction(() => {
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
                    let recordingRoute = this.selectedRouteService.getRouteById(this.recordingRouteId);
                    if (recordingRoute != null && recordingRoute.isRecording) {
                        this.lastRecordedRoute = recordingRoute;
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
                        this.ngRedux.dispatch(new AddRouteAction({
                            routeData: this.lastRecordedRoute
                        }));
                        this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: this.lastRecordedRoute.id }));
                        this.recordingRouteId = this.lastRecordedRoute.id;
                    },
                    declineAction: () => {
                        this.lastRecordedRoute.isRecording = false;
                        this.ngRedux.dispatch(new AddLocallyRecordedRouteAction({
                            routeData: this.lastRecordedRoute
                        }));
                        this.lastRecordedRoute = null;
                    },
                });
            });
        }
    }

    public resetRotation() {
        this.host.instance.getView().animate({
            rotation: 0
        });
    }

    public getRotationAngle() {
        return `rotate(${this.host.instance.getView().getRotation()}rad)`;
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
        let recordingRoute = this.selectedRouteService.getRouteById(this.recordingRouteId);
        return recordingRoute != null && recordingRoute.isRecording;
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
            this.ngRedux.dispatch(new StopRecordingAction({
                routeId: this.recordingRouteId
            }));
            this.ngRedux.dispatch(new AddLocallyRecordedRouteAction({
                routeData: this.selectedRouteService.getRouteById(this.recordingRouteId)
            }));
            this.lastRecordedRoute = null;
            this.recordingRouteId = null;
        }
    }

    private createRecordingRoute() {
        let date = new Date();
        let name = this.resources.route + " " + date.toISOString().split("T")[0];
        if (!this.selectedRouteService.isNameAvailable(name)) {
            let dateString =
                `${date.toISOString().split("T")[0]} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
            name = this.resources.route + " " + dateString;
        }
        let route = this.routeLayerFactory.createRouteData(name);
        route.isRecording = true;
        let currentLocation = this.geoLocationService.currentLocation;
        route.segments.push({
            routingType: this.routeLayerFactory.routingType,
            latlngs: [currentLocation, currentLocation],
            routePoint: currentLocation
        });
        route.segments.push({
            routingType: this.routeLayerFactory.routingType,
            latlngs: [currentLocation],
            routePoint: currentLocation
        });
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: route
        }));
        this.ngRedux.dispatch(new SetSelectedRouteAction({
            routeId: route.id
        }));
        this.recordingRouteId = route.id;
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
        if (position.coords.heading != null) {
            this.host.instance.getView().animate({
                rotation: position.coords.heading * Math.PI / 180
            });
        }
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