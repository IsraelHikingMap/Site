import { Component } from "@angular/core";
import { LocalStorage } from "ngx-store";
import { MapComponent } from "ngx-mapbox-gl";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { CancelableTimeoutService } from "../services/cancelable-timeout.service";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../services/spatial.service";
import { DeviceOrientationService } from "../services/device-orientation.service";
import { RecordedRouteService } from "../services/recorded-route.service";
import { LatLngAlt } from "../models/models";

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
    private lastSpeed: number;
    private lastSpeedTime: number;

    public locationFeatures: GeoJSON.FeatureCollection<GeoJSON.Geometry>;
    public isFollowing: boolean;
    public isKeepNorthUp: boolean;
    public locationLatLng: LatLngAlt;

    constructor(resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly toastService: ToastService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly recordedRouteService: RecordedRouteService,
                private readonly cancelableTimeoutService: CancelableTimeoutService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly deviceOrientationService: DeviceOrientationService,
                private readonly host: MapComponent) {
        super(resources);

        this.isFollowing = true;
        this.isPanned = false;
        this.isKeepNorthUp = false;
        this.locationLatLng = null;
        this.lastSpeed = null;
        this.lastSpeedTime = null;
        this.clearLocationFeatureCollection();

        this.host.load.subscribe(() => {
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
                            this.moveMapToGpsPosition();
                        }
                    },
                        LocationComponent.NOT_FOLLOWING_TIMEOUT,
                        "panned");
                });
        });

        this.geoLocationService.positionChanged.subscribe(
            (position: Position) => {
                if (position != null) {
                    this.handlePositionChange(position);
                }
            });
        this.geoLocationService.bulkPositionChanged.subscribe(
            (positions: Position[]) => {
                this.handlePositionChange(positions[positions.length - 1]);
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
            if (!this.host.mapInstance.isMoving() && this.isFollowingLocation()) {
                this.moveMapToGpsPosition();
            }
        });
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
        this.locationLatLng = this.getCenterFromLocationFeatureCollection();
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
            this.disableLocation();
            return;
        }
        if (this.isDisabled()) {
            this.enableLocation();
            return;
        }
        // is active must be true
        if (!this.isFollowing || this.isPanned) {
            this.isFollowing = true;
            this.isPanned = false;
            this.moveMapToGpsPosition();
            return;
        }
        // following and not panned
        if (this.isRecording()) {
            this.isFollowing = false;
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
                    this.recordedRouteService.stopRecording();
                }
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
            this.recordedRouteService.startRecording();
        }
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
        if (!this.host.mapInstance.isMoving() && this.isFollowingLocation()) {
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
        this.isFollowing = true;
        this.isPanned = false;
    }

    private moveMapToGpsPosition() {
        if (this.locationFeatures.features.length === 0) {
            return;
        }
        let center = this.getCenterFromLocationFeatureCollection();
        let bearing = this.isKeepNorthUp
            ? 0
            : this.getBrearingFromLocationFeatureCollection();
        this.fitBoundsService.moveTo(center, this.host.mapInstance.getZoom(), bearing);
    }

    private getCenterFromLocationFeatureCollection(): LatLngAlt {
        let pointGeometry = this.locationFeatures.features.map(f => f.geometry).find(g => g.type === "Point") as GeoJSON.Point;
        let coordinates = pointGeometry.coordinates as [number, number];
        return SpatialService.toLatLng(coordinates);
    }

    private getBrearingFromLocationFeatureCollection(): number {
        let pointFeature = this.locationFeatures.features.find(f => f.geometry.type === "Point");
        return pointFeature == null
            ? this.host.mapInstance.getBearing()
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
    }
}
