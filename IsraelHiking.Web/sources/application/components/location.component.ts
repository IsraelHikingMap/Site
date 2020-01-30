import { Component } from "@angular/core";
import { LocalStorage } from "ngx-store";
import { first } from "rxjs/operators";
import { NgRedux } from "@angular-redux/store";
import { MapComponent } from "ngx-mapbox-gl";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { RoutesFactory } from "../services/layers/routelayers/routes.factory";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../services/spatial.service";
import { FileService } from "../services/file.service";
import { LoggingService } from "../services/logging.service";
import { AddRouteAction, AddRecordingPointsAction } from "../reducres/routes.reducer";
import { AddTraceAction } from "../reducres/traces.reducer";
import { StopRecordingAction, StartRecordingAction } from "../reducres/route-editing-state.reducer";
import { RouteData, ApplicationState, LatLngAlt, DataContainer, TraceVisibility, ILatLngTime } from "../models/models";

@Component({
    selector: "location",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.scss"]
})
export class LocationComponent extends BaseMapComponent {

    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;

    @LocalStorage()
    private showBatteryConfirmation = true;

    private isPanned: boolean;

    public locationFeatures: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public isFollowing: boolean;
    public isKeepNorthUp: boolean;
    public locationLatLng: LatLngAlt;

    constructor(resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly toastService: ToastService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routesFactory: RoutesFactory,
                private readonly cancelableTimeoutService: CancelableTimeoutService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly fileService: FileService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly host: MapComponent) {
        super(resources);

        this.isFollowing = true;
        this.isPanned = false;
        this.isKeepNorthUp = false;
        this.locationLatLng = null;
        this.updateLocationFeatureCollection(null);

        this.host.load.subscribe(() => {
            let fullFilePath = this.fileService.getFullFilePath("content/gps-direction.png");
            this.host.mapInstance.loadImage(fullFilePath, (_, img) => {
                this.host.mapInstance.addImage("gps-direction", img);
            });
            this.host.mapInstance.on("dragstart",
                () => {
                    if (!this.isActive()) {
                        return;
                    }
                    this.isPanned = true;
                    this.cancelableTimeoutService.clearTimeoutByGroup("panned");
                    this.cancelableTimeoutService.setTimeoutByGroup(() => {
                        this.isPanned = false;
                        if (this.isFollowingLocation()) {
                            this.setLocation();
                        }
                    },
                        LocationComponent.NOT_FOLLOWING_TIMEOUT,
                        "panned");
                });
        });

        this.geoLocationService.positionChanged.subscribe(
            (position: Position) => {
                if (position == null) {
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                } else {
                    this.handlePositionChange(position);
                    this.updateRecordingRouteIfNeeded([this.geoLocationService.currentLocation]);
                }
            });
        this.geoLocationService.bulkPositionChanged.subscribe(
            (positions: Position[]) => {
                this.handlePositionChange(positions[positions.length - 1]);
                let latlngs = positions.map(p => this.geoLocationService.positionToLatLngTime(p));
                this.updateRecordingRouteIfNeeded(latlngs);
            });

        let lastRecordedRoute = this.selectedRouteService.getRecordingRoute();
        if (lastRecordedRoute != null) {
            this.resources.languageChanged.pipe(first()).toPromise().then(() => {
                // let resources service get the strings
                this.toastService.confirm({
                    message: this.resources.continueRecording,
                    type: "YesNo",
                    confirmAction: () => {
                        this.toggleTracking();
                        this.selectedRouteService.setSelectedRoute(lastRecordedRoute.id);
                    },
                    declineAction: () => {
                        this.stopRecording();
                    },
                });
            });
        }
    }

    public isFollowingLocation(): boolean {
        return this.isFollowing && !this.isPanned;
    }

    public openLocationPopup() {
        if (this.locationLatLng != null) {
            this.locationLatLng = null;
            return;
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
            return;
        }
        let coordinates = (this.locationFeatures.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        this.locationLatLng = SpatialService.toLatLng(coordinates);
    }

    public toggleKeepNorthUp() {
        this.isKeepNorthUp = !this.isKeepNorthUp;
        if (this.isKeepNorthUp) {
           this.host.mapInstance.rotateTo(0);
        }
    }

    public getRotationAngle() {
        if (this.host.mapInstance == null) {
            return 0;
        }
        return `rotate(${-this.host.mapInstance.getBearing()}deg)`;
    }

    public toggleTracking() {
        if (this.isLoading()) {
            this.disableGeoLocation();
            return;
        }
        if (this.isDisabled()) {
            this.geoLocationService.enable();
            this.isFollowing = true;
            this.isPanned = false;
            return;
        }
        // is active must be true
        if (!this.isFollowing || this.isPanned) {
            this.isFollowing = true;
            this.isPanned = false;
            this.setLocation();
            return;
        }
        // following and not panned
        if (this.isRecording()) {
            this.isFollowing = false;
            return;
        }
        if (!this.isRecording()) {
            this.disableGeoLocation();
            return;
        }
    }

    public canRecord() {
        return this.geoLocationService.canRecord();
    }

    public isRecording() {
        return this.selectedRouteService.getRecordingRoute() != null;
    }

    public toggleRecording() {
        if (this.isRecording()) {
            this.toastService.confirm({
                message: this.resources.areYouSureYouWantToStopRecording,
                type: "YesNo",
                confirmAction: () => {
                    this.stopRecording();
                },
                declineAction: () => { },
            });
        } else {
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
        }
    }

    private stopRecording() {
        this.loggingService.debug("Stop recording");
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        this.ngRedux.dispatch(new StopRecordingAction({
            routeId: recordingRoute.id
        }));
        this.addRecordingToTraces(recordingRoute);
    }

    private createRecordingRoute() {
        this.loggingService.debug("Starting recording");
        let date = new Date();
        let name = this.resources.route + " " + date.toISOString().split("T")[0];
        if (!this.selectedRouteService.isNameAvailable(name)) {
            let dateString =
                `${date.toISOString().split("T")[0]} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
            name = this.resources.route + " " + dateString;
        }
        let route = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
        let currentLocation = this.geoLocationService.currentLocation;
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        route.segments.push({
            routingType,
            latlngs: [currentLocation, currentLocation],
            routePoint: currentLocation
        });
        route.segments.push({
            routingType,
            latlngs: [currentLocation],
            routePoint: currentLocation
        });
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: route
        }));
        this.selectedRouteService.setSelectedRoute(route.id);
        this.ngRedux.dispatch(new StartRecordingAction({
            routeId: route.id
        }));
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

    private handlePositionChange(position: Position) {
        if (this.locationFeatures.features.length === 0) {
            this.isFollowing = true;
        }
        let heading = null;
        let needToUpdateHeading = !isNaN(position.coords.heading) && position.coords.speed !== 0;
        if (needToUpdateHeading) {
            heading = position.coords.heading;
        }
        this.updateLocationFeatureCollection({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude
        }, position.coords.accuracy, heading);

        if (!this.host.mapInstance.isMoving()) {
            if (this.isFollowingLocation() && this.isKeepNorthUp) {
                this.setLocation();
            } else if (this.isFollowingLocation() && !this.isKeepNorthUp && needToUpdateHeading) {
                this.setLocation(position.coords.heading);
            } else if (this.isFollowingLocation() && !this.isKeepNorthUp && !needToUpdateHeading) {
                this.setLocation();
            }
        }
    }

    private updateRecordingRouteIfNeeded(locations: ILatLngTime[]) {
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        if (recordingRoute != null) {
            this.loggingService.debug("Adding a new point/s to the recording route.");
            this.ngRedux.dispatch(new AddRecordingPointsAction({
                routeId: recordingRoute.id,
                latlngs: locations
            }));
        }
    }

    private disableGeoLocation() {
        this.geoLocationService.disable();
        if (this.locationFeatures.features.length > 0) {
            this.updateLocationFeatureCollection(null);
        }
    }

    private setLocation(bearing?: number) {
        if (this.locationFeatures.features.length > 0) {
            let pointGeometry = this.locationFeatures.features.map(f => f.geometry).find(g => g.type === "Point") as GeoJSON.Point;
            let coordinates = pointGeometry.coordinates as [number, number];
            let center = SpatialService.toLatLng(coordinates);
            let zoom = this.host.mapInstance.getZoom();
            if (bearing) {
                this.host.mapInstance.easeTo({ bearing, center, zoom });
            } else {
                this.fitBoundsService.flyTo(center, this.host.mapInstance.getZoom());
            }
        }
    }

    private addRecordingToTraces(routeData: RouteData) {
        let latLngs = routeData.segments[0].latlngs;
        let northEast = { lat: Math.max(...latLngs.map(l => l.lat)), lng: Math.max(...latLngs.map(l => l.lng)) };
        let southWest = { lat: Math.min(...latLngs.map(l => l.lat)), lng: Math.min(...latLngs.map(l => l.lng)) };
        let container = {
            routes: [routeData],
            northEast,
            southWest
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
        this.ngRedux.dispatch(new AddTraceAction({ trace }));
    }

    private updateLocationFeatureCollection(center: LatLngAlt, radius?: number, heading?: number) {
        if (center == null) {
            this.locationFeatures = {
                type: "FeatureCollection",
                features: []
            };
            return;
        }
        if (heading == null && this.locationFeatures.features.length > 0) {
            heading = this.locationFeatures.features[0].properties.heading;
        }
        let features: GeoJSON.Feature<GeoJSON.Geometry>[] = [{
            type: "Feature",
            properties: { heading },
            geometry: {
                type: "Point",
                coordinates: SpatialService.toCoordinate(center)
            }
        }];
        if (radius != null) {
            features.push(SpatialService.getCirclePolygon(center, radius));
        }
        this.locationFeatures = {
            type: "FeatureCollection",
            features
        };
    }
}
