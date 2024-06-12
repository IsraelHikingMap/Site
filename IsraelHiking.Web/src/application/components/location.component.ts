import { Component } from "@angular/core";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";

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
import { StopShowingBatteryConfirmationAction } from "../reducers/configuration.reducer";
import { ChangeRouteStateAction } from "../reducers/routes.reducer";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import type { LatLngAlt, ApplicationState } from "../models/models";

@Component({
    selector: "location",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.scss"]
})
export class LocationComponent extends BaseMapComponent {

    public distance$: Observable<boolean>;

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
                private readonly store: Store,
                private readonly mapComponent: MapComponent) {
        super(resources);

        this.isKeepNorthUp = false;
        this.locationLatLng = null;
        this.lastSpeed = null;
        this.lastSpeedTime = null;
        this.clearLocationFeatureCollection();

        this.distance$ = this.store.select((state: ApplicationState) => state.inMemoryState.distance);
        this.distance$.subscribe(distance => {
            this.showDistance = distance;
            this.updateDistanceFeatureCollection();
        });

        this.store.select((state: ApplicationState) => state.inMemoryState.pannedTimestamp).subscribe(pannedTimestamp => {
            this.isPanned = pannedTimestamp != null;
            if (this.isPanned) {
                return;
            }
            if (!this.isActive()) {
                return;
            }
            if (this.showDistance) {
                this.store.dispatch(new ToggleDistanceAction());
            }
            if (this.isFollowingLocation()) {
                this.moveMapToGpsPosition();
                const selectedRoute = this.selectedRouteService.getSelectedRoute();
                if (selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
                    this.toastService.warning(this.resources.editingRouteWhileTracking);
                }
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

            this.store.select((state: ApplicationState) => state.gpsState.currentPosition).subscribe(position => {
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
                const center = this.getCenterFromLocationFeatureCollection();
                const radius = this.getRadiusFromLocationFeatureCollection();
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
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).following && !this.isPanned;
    }

    public openLocationPopup() {
        if (this.locationLatLng != null) {
            this.locationLatLng = null;
            return;
        }
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
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
            this.store.dispatch(new SetFollowingAction(true));
            this.store.dispatch(new SetPannedAction(null));
            if (this.showDistance) {
                this.store.dispatch(new ToggleDistanceAction());
            }
            this.moveMapToGpsPosition();
            return;
        }
        // following and not panned
        if (this.isRecording()) {
            this.store.dispatch(new SetFollowingAction(false));
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
                    this.store.dispatch(new SetFollowingAction(true));
                    this.recordedRouteService.stopRecording();
                }
            });
        } else {
            if (this.store.selectSnapshot((s: ApplicationState) => s.configuration).isShowBatteryConfirmation) {
                this.toastService.confirm({
                    message: this.resources.makeSureBatteryOptimizationIsOff,
                    type: "Custom",
                    declineAction: () => {
                        this.store.dispatch(new StopShowingBatteryConfirmationAction());
                    },
                    customConfirmText: this.resources.ok,
                    customDeclineText: this.resources.dontShowThisMessageAgain
                });
            }
            this.recordedRouteService.startRecording();
        }
    }

    public isDisabled() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "disabled";
    }

    public isActive() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "tracking";
    }

    public isLoading() {
        return this.store.selectSnapshot((s: ApplicationState) => s.gpsState).tracking === "searching";
    }

    public isAddingRecordingPoi() {
        return this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi;
    }

    public toggleAddRecordingPoi() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && (selectedRoute.state === "Poi" || selectedRoute.state === "Route")) {
            this.store.dispatch(new ChangeRouteStateAction(selectedRoute.id, "ReadOnly"));
        }
        this.store.dispatch(new ToggleAddRecordingPoiAction());
    }

    private handlePositionChange(position: GeolocationPosition) {
        if (this.locationFeatures.features.length === 0) {
            this.store.dispatch(new SetFollowingAction(true));
        }
        const validHeading = !isNaN(position.coords.heading) && position.coords.speed !== 0;
        if (validHeading) {
            this.lastSpeed = position.coords.speed;
            this.lastSpeedTime = new Date().getTime();
        }
        const heading = validHeading ? position.coords.heading : this.getBrearingFromLocationFeatureCollection();
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
        this.store.dispatch(new SetFollowingAction(true));
        this.store.dispatch(new SetPannedAction(null));
    }

    private moveMapToGpsPosition() {
        if (this.locationFeatures.features.length === 0) {
            return;
        }
        const center = this.getCenterFromLocationFeatureCollection();
        const bearing = this.isKeepNorthUp
            ? 0
            : this.getBrearingFromLocationFeatureCollection();
        this.fitBoundsService.moveTo(center, this.mapComponent.mapInstance.getZoom(), bearing);
    }

    private getCenterFromLocationFeatureCollection(): LatLngAlt {
        const pointGeometry = this.locationFeatures.features.map(f => f.geometry).find(g => g.type === "Point") as GeoJSON.Point;
        const coordinates = pointGeometry.coordinates as [number, number];
        return SpatialService.toLatLng(coordinates);
    }

    private getBrearingFromLocationFeatureCollection(): number {
        const pointFeature = this.locationFeatures.features.find(f => f.geometry.type === "Point");
        return pointFeature == null
            ? this.mapComponent.mapInstance.getBearing()
            : pointFeature.properties.heading;
    }

    private getRadiusFromLocationFeatureCollection(): number {
        const radiusFeature = this.locationFeatures.features.find(f => f.geometry.type === "Polygon");
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
        const features: GeoJSON.Feature<GeoJSON.Geometry>[] = [{
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

        const center = this.mapComponent.mapInstance.getCenter();
        const gps = this.getCenterFromLocationFeatureCollection();
        const distance = SpatialService.getDistanceInMeters(center, gps);
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
