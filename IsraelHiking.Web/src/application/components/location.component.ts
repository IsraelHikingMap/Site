import { Component } from "@angular/core";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Observable } from "rxjs";
import { NgRedux, Select } from "@angular-redux2/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { SelectedRouteService } from "../services/selected-route.service";
import { SpatialService } from "../services/spatial.service";
import { DeviceOrientationService } from "../services/device-orientation.service";
import { RecordedRouteService } from "../services/recorded-route.service";
import { ToggleDistanceAction, SetPannedAction, SetFollowingAction } from "../reducers/in-memory.reducer";
import { ConfigurationActions } from "../reducers/configuration.reducer";
import { ChangeEditStateAction } from "../reducers/routes.reducer";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import type { LatLngAlt, ApplicationState } from "../models/models";

@Component({
    selector: "location",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.scss"]
})
export class LocationComponent extends BaseMapComponent {

    @Select((state: ApplicationState) => state.inMemoryState.distance)
    public distance$: Observable<boolean>;

    @Select((state: ApplicationState) => state.inMemoryState.pannedTimestamp)
    public pannedTimestamp$: Observable<Date>;

    @Select((state: ApplicationState) => state.gpsState.currentPoistion)
    private currentPoistion$: Observable<GeolocationPosition>;

    private lastSpeed: number;
    private lastSpeedTime: number;
    private isPanned: boolean;

    public locationFeatures: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public distanceFeatures: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public isKeepNorthUp: boolean;
    public locationLatLng: LatLngAlt;
    public showDistance: boolean;

    constructor(resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly toastService: ToastService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly recordedRouteService: RecordedRouteService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly deviceOrientationService: DeviceOrientationService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly mapComponent: MapComponent) {
        super(resources);

        this.isKeepNorthUp = false;
        this.locationLatLng = null;
        this.lastSpeed = null;
        this.lastSpeedTime = null;
        this.clearLocationFeatureCollection();

        this.distance$.subscribe(distance => {
            this.showDistance = distance;
            this.updateDistanceFeatureCollection();
        });

        this.pannedTimestamp$.subscribe(pannedTimestamp => {
            this.isPanned = pannedTimestamp != null;
            if (this.isPanned) {
                return;
            }
            if (!this.isActive()) {
                return;
            }
            if (this.showDistance) {
                this.ngRedux.dispatch(new ToggleDistanceAction());
            }
            if (this.isFollowingLocation()) {
                this.moveMapToGpsPosition();
            }
        });

        this.mapComponent.mapLoad.subscribe(() => {
            this.mapComponent.mapInstance.on("move", () => {
                this.updateDistanceFeatureCollection();
            });

            this.mapComponent.mapInstance.on("resize", () => {
                if (this.locationFeatures.features.length > 0 && this.isFollowingLocation()) {
                    this.mapComponent.mapInstance.setCenter(this.getCenterFromLocationFeatureCollection());
                }
            });

            this.currentPoistion$.subscribe((position: GeolocationPosition) => {
                if (position != null) {
                    this.handlePositionChange(position);
                }
            });

            this.deviceOrientationService.orientationChanged.subscribe((bearing: number) => {
                if (!this.isActive() || this.locationFeatures.features.length === 0) {
                    return;
                }
                if (this.lastSpeed != null && new Date().getTime() - this.lastSpeedTime < 5000) {
                    return;
                }
                this.lastSpeed = null;
                let center = this.getCenterFromLocationFeatureCollection();
                let radius = this.getRadiusFromLocationFeatureCollection();
                this.updateLocationFeatureCollection(center, radius, bearing);
                if (!this.mapComponent.mapInstance.isMoving() && this.isFollowingLocation()) {
                    this.moveMapToGpsPosition();
                }
            });

            this.geoLocationService.backToForeground.subscribe(() => {
                if (this.isFollowingLocation()) {
                    this.moveMapToGpsPosition();
                }
            });
        });
    }

    public isFollowingLocation(): boolean {
        return this.ngRedux.getState().inMemoryState.following && !this.isPanned;
    }

    public openLocationPopup() {
        if (this.locationLatLng != null) {
            this.locationLatLng = null;
            return;
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && selectedRoute.state === "Route") {
            return;
        }
        this.locationLatLng = this.getCenterFromLocationFeatureCollection();
    }

    public toggleKeepNorthUp() {
        this.isKeepNorthUp = !this.isKeepNorthUp;
        if (this.isKeepNorthUp) {
           this.mapComponent.mapInstance.rotateTo(0);
        }
    }

    public getRotationAngle() {
        if (this.mapComponent.mapInstance == null) {
            return 0;
        }
        return `rotate(${-this.mapComponent.mapInstance.getBearing()}deg)`;
    }

    public toggleTracking() {
        if (this.isLoading()) {
            this.disableLocation();
            return;
        }
        if (this.isDisabled()) {
            this.enableLocation();
            return;
        }
        // is active must be true
        if (!this.isFollowingLocation()) {
            this.ngRedux.dispatch(new SetFollowingAction({ following: true }));
            this.ngRedux.dispatch(new SetPannedAction({ pannedTimestamp: null }));
            if (this.showDistance) {
                this.ngRedux.dispatch(new ToggleDistanceAction());
            }
            this.moveMapToGpsPosition();
            return;
        }
        // following and not panned
        if (this.isRecording()) {
            this.ngRedux.dispatch(new SetFollowingAction({ following: false }));
            return;
        }
        if (!this.isRecording()) {
            this.disableLocation();
            return;
        }
    }

    public canRecord() {
        return this.geoLocationService.canRecord();
    }

    public isRecording() {
        return this.recordedRouteService.isRecording();
    }

    public toggleRecording() {
        if (this.isRecording()) {
            this.toastService.confirm({
                message: this.resources.areYouSureYouWantToStopRecording,
                type: "YesNo",
                confirmAction: () => {
                    this.ngRedux.dispatch(new SetFollowingAction({ following: true }));
                    this.recordedRouteService.stopRecording();
                }
            });
        } else {
            if (this.ngRedux.getState().configuration.isShowBatteryConfirmation) {
                this.toastService.confirm({
                    message: this.resources.makeSureBatteryOptimizationIsOff,
                    type: "Custom",
                    declineAction: () => {
                        this.ngRedux.dispatch(ConfigurationActions.stopShowBatteryConfirmationAction);
                    },
                    customConfirmText: this.resources.ok,
                    customDeclineText: this.resources.dontShowThisMessageAgain
                });
            }
            this.recordedRouteService.startRecording();
        }
    }

    public isDisabled() {
        return this.ngRedux.getState().gpsState.tracking === "disabled";
    }

    public isActive() {
        return this.ngRedux.getState().gpsState.tracking === "tracking";
    }

    public isLoading() {
        return this.ngRedux.getState().gpsState.tracking === "searching";
    }

    public isAddingRecordingPoi() {
        return this.ngRedux.getState().recordedRouteState.isAddingPoi;
    }

    public toggleAddRecordingPoi() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
            this.ngRedux.dispatch(new ChangeEditStateAction({ routeId: selectedRoute.id, state: "ReadOnly" }));
        }
        this.ngRedux.dispatch(new ToggleAddRecordingPoiAction());
    }

    private handlePositionChange(position: GeolocationPosition) {
        if (this.locationFeatures.features.length === 0) {
            this.ngRedux.dispatch(new SetFollowingAction({ following: true }));
        }
        let validHeading = !isNaN(position.coords.heading) && position.coords.speed !== 0;
        if (validHeading) {
            this.lastSpeed = position.coords.speed;
            this.lastSpeedTime = new Date().getTime();
        }
        let heading = validHeading ? position.coords.heading : this.getBrearingFromLocationFeatureCollection();
        this.updateLocationFeatureCollection({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            alt: position.coords.altitude
        }, position.coords.accuracy, heading);
        if (!this.mapComponent.mapInstance.isMoving() && this.isFollowingLocation()) {
            this.moveMapToGpsPosition();
        }
    }

    private disableLocation() {
        this.geoLocationService.disable();
        this.deviceOrientationService.disable();
        this.clearLocationFeatureCollection();
    }

    private enableLocation() {
        this.geoLocationService.enable();
        this.deviceOrientationService.enable();
        this.ngRedux.dispatch(new SetFollowingAction({ following: true }));
        this.ngRedux.dispatch(new SetPannedAction({ pannedTimestamp: null }));
    }

    private moveMapToGpsPosition() {
        if (this.locationFeatures.features.length === 0) {
            return;
        }
        let center = this.getCenterFromLocationFeatureCollection();
        let bearing = this.isKeepNorthUp
            ? 0
            : this.getBrearingFromLocationFeatureCollection();
        this.fitBoundsService.moveTo(center, this.mapComponent.mapInstance.getZoom(), bearing);
    }

    private getCenterFromLocationFeatureCollection(): LatLngAlt {
        let pointGeometry = this.locationFeatures.features.map(f => f.geometry).find(g => g.type === "Point") as GeoJSON.Point;
        let coordinates = pointGeometry.coordinates as [number, number];
        return SpatialService.toLatLng(coordinates);
    }

    private getBrearingFromLocationFeatureCollection(): number {
        let pointFeature = this.locationFeatures.features.find(f => f.geometry.type === "Point");
        return pointFeature == null
            ? this.mapComponent.mapInstance.getBearing()
            : pointFeature.properties.heading;
    }

    private getRadiusFromLocationFeatureCollection(): number {
        let radiusFeature = this.locationFeatures.features.find(f => f.geometry.type === "Polygon");
        if (radiusFeature == null) {
            return null;
        }
        return radiusFeature.properties.radius;
    }

    private clearLocationFeatureCollection() {
        this.locationFeatures = {
            type: "FeatureCollection",
            features: []
        };
        this.clearDistanceFeatureCollection();
    }

    private updateLocationFeatureCollection(center: LatLngAlt, radius: number, heading: number) {
        let features: GeoJSON.Feature<GeoJSON.Geometry>[] = [{
            type: "Feature",
            properties: { heading },
            geometry: {
                type: "Point",
                coordinates: SpatialService.toCoordinate(center)
            }
        }];
        if (radius != null) {
            features.push(SpatialService.getCirclePolygonFeature(center, radius));
        }
        this.locationFeatures = {
            type: "FeatureCollection",
            features
        };
        this.updateDistanceFeatureCollection();
    }

    private clearDistanceFeatureCollection() {
        this.distanceFeatures = {
            type: "FeatureCollection",
            features: []
        };
    }

    private updateDistanceFeatureCollection() {
        if (!this.isActive() || !this.showDistance) {
            this.clearDistanceFeatureCollection();
            return;
        }

        let center = this.mapComponent.mapInstance.getCenter();
        let gps = this.getCenterFromLocationFeatureCollection();
        let distance = SpatialService.getDistanceInMeters(center, gps);
        this.distanceFeatures = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: {},
                geometry: {
                    type: "LineString",
                    coordinates: [SpatialService.toCoordinate(gps), SpatialService.toCoordinate(center)]
                }
            },
            {
                type: "Feature",
                properties: {
                    distance: (distance / 1000.0).toFixed(2) + " " + this.resources.kmUnit
                },
                geometry: {
                    type: "Point",
                    coordinates: SpatialService.toCoordinate(center)
                }
            }]
        };
    }
}
