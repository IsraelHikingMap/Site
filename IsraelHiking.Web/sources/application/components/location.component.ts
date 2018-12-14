import { Component } from "@angular/core";
import { LocalStorage } from "ngx-store";
import { first } from "rxjs/operators";
import { NgRedux } from "@angular-redux/store";
import { MapBrowserEvent, Feature } from "openlayers";
import { MapComponent } from "ngx-openlayers";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { RouteLayerFactory } from "../services/layers/routelayers/route-layer.factory";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { DragInteraction } from "./intercations/drag.interaction";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { AddRouteAction, StopRecordingAction, AddRecordingPointAction } from "../reducres/routes.reducer";
import { RouteData, ApplicationState, LatLngAlt, DataContainer, TraceVisibility } from "../models/models";
import { AddTraceAction } from "../reducres/traces.reducer";
import { FitBoundsService } from "../services/fit-bounds.service";

interface ILocationInfo extends LatLngAlt {
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
    public isLocationOverlayOpen: boolean;

    constructor(resources: ResourcesService,
        private readonly geoLocationService: GeoLocationService,
        private readonly toastService: ToastService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly cancelableTimeoutService: CancelableTimeoutService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly ngRedux: NgRedux<ApplicationState>,
        private readonly host: MapComponent) {
        super(resources);

        this.locationCoordinate = null;
        this.recordingRouteId = null;
        this.isFollowing = true;
        this.isLocationOverlayOpen = false;

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

        this.host.instance.on("singleclick",
            (event: MapBrowserEvent) => {
                let selectedRoute = this.selectedRouteService.getSelectedRoute();
                if (selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
                    return;
                }
                let features = (event.map.getFeaturesAtPixel(event.pixel, { hitTolerance: 10 }) || []) as Feature[];
                if (features.find(f => f.getId() as string === "location") != null) {
                    this.isLocationOverlayOpen = !this.isLocationOverlayOpen;
                }
            });

        this.geoLocationService.positionChanged.subscribe(
            (position: Position) => {
                if (position == null) {
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                } else {
                    this.updateMarkerPosition(position);
                    let recordingRoute = this.selectedRouteService.getRouteById(this.recordingRouteId);
                    if (recordingRoute != null && recordingRoute.isRecording) {
                        this.ngRedux.dispatch(new AddRecordingPointAction({
                            routeId: recordingRoute.id,
                            latlng: this.geoLocationService.currentLocation
                        }));
                        this.lastRecordedRoute = this.selectedRouteService.getRouteById(this.recordingRouteId);
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
                        this.selectedRouteService.setSelectedRoute(this.lastRecordedRoute.id);
                        this.recordingRouteId = this.lastRecordedRoute.id;
                    },
                    declineAction: () => {
                        this.lastRecordedRoute.isRecording = false;
                        this.addRecordingToTraces(this.lastRecordedRoute);
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
            this.addRecordingToTraces(this.selectedRouteService.getRouteById(this.recordingRouteId));
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
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        route.segments.push({
            routingType: routingType,
            latlngs: [currentLocation, currentLocation],
            routePoint: currentLocation
        });
        route.segments.push({
            routingType: routingType,
            latlngs: [currentLocation],
            routePoint: currentLocation
        });
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: route
        }));
        this.selectedRouteService.setSelectedRoute(route.id);
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
        this.locationCoordinate.lng = position.coords.longitude;
        this.locationCoordinate.lat = position.coords.latitude;
        this.locationCoordinate.alt = position.coords.altitude;
        this.locationCoordinate.radius = position.coords.accuracy;
        if (this.isFollowing) {
            this.setLocation();
        }
        if (position.coords.heading != null && position.coords.heading !== NaN) {
            this.host.instance.getView().animate({
                rotation: - position.coords.heading * Math.PI / 180.0
            });
        }
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
        this.fitBoundsService.flyTo(this.locationCoordinate);
    }

    private addRecordingToTraces(routeData: RouteData) {
        let latLngs = routeData.segments[0].latlngs;
        let northEast = { lat: Math.max(...latLngs.map(l => l.lat)), lng: Math.max(...latLngs.map(l => l.lng)) };
        let southWest = { lat: Math.min(...latLngs.map(l => l.lat)), lng: Math.min(...latLngs.map(l => l.lng)) };
        let container = {
            routes: [routeData],
            northEast: northEast,
            southWest: southWest
        } as DataContainer;

        let trace = {
            name: routeData.name,
            description: routeData.description,
            id: routeData.id,
            timeStamp: routeData.segments[0].latlngs[0].timestamp,
            dataContainer: container,
            tags: [],
            tagsString: "",
            visibility: "local" as TraceVisibility,
            isInEditMode: false,
            url: "",
            imageUrl: "",
            dataUrl: "",
            user: ""
        };
        this.ngRedux.dispatch(new AddTraceAction({ trace: trace }));
    }
}