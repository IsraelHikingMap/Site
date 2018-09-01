import { Component, ComponentFactoryResolver, Injector } from "@angular/core";
import * as L from "leaflet";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { MapService } from "../services/map.service";
import { GpsLocationMarkerPopupComponent } from "./markerpopup/gps-location-marker-popup.component";
import { IconsService } from "../services/icons.service";
import { RoutesService } from "../services/layers/routelayers/routes.service";
import { RouteLayerFactory } from "../services/layers/routelayers/route-layer.factory";
import { IRouteLayer, IRouteSegment } from "../services/layers/routelayers/iroute.layer";
import * as Common from "../common/IsraelHiking";

@Component({
    selector: "location-control",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.css"]
})
export class LocationComponent extends BaseMapComponent {

    private locationMarker: Common.IMarkerWithTitle;
    private accuracyCircle: L.Circle;
    private routeLayer: IRouteLayer;

    public isFollowing: boolean;

    constructor(resources: ResourcesService,
        private readonly injector: Injector,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly mapService: MapService,
        private readonly geoLocationService: GeoLocationService,
        private readonly toastService: ToastService,
        private readonly routesService: RoutesService,
        private readonly routeLayerFactory: RouteLayerFactory) {
        super(resources);

        this.locationMarker = null;
        this.accuracyCircle = null;
        this.routeLayer = null;
        this.isFollowing = true;

        this.mapService.map.on("dragstart",
            () => {
                this.isFollowing = false;
            });

        this.geoLocationService.positionChanged.subscribe(
            (position) => {
                if (position == null) {
                    this.toastService.warning(this.resources.unableToFindYourLocation);
                } else {
                    this.updateMarkerPosition(position);
                }
            });
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
            this.mapService.map.flyTo(this.locationMarker.getLatLng());
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
            let route = this.routeLayerFactory.createRoute(this.resources.route + " " + new Date().toISOString().split("T")[0]);
            this.routesService.addRoute(route);
            this.routeLayer = this.routesService.selectedRoute;
            this.routeLayer.setRecordingState();
        } else {
            this.routeLayer.setReadOnlyState();
            this.routeLayer = null;
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

    private updateMarkerPosition(position: Position) {
        let latLng = L.latLng(position.coords.latitude, position.coords.longitude, position.coords.altitude);
        let radius = position.coords.accuracy;
        if (this.locationMarker != null) {
            this.locationMarker.setLatLng(latLng);
            this.accuracyCircle.setLatLng(latLng).setRadius(radius);
            if (this.isFollowing) {
                this.mapService.map.flyTo(latLng);
            }
            return;
        }
        this.locationMarker = L.marker(latLng,
            {
                clickable: true,
                draggable: false,
                icon: IconsService.createLocationIcon()
            } as L.MarkerOptions) as Common.IMarkerWithTitle;
        this.accuracyCircle = L.circle(latLng, radius, {
            color: "#136AEC",
            fillColor: "#136AEC",
            fillOpacity: 0.15,
            weight: 2,
            opacity: 0.5,
            interactive: false,
        });
        let controlDiv = L.DomUtil.create("div");
        let componentFactory = this.componentFactoryResolver.resolveComponentFactory(GpsLocationMarkerPopupComponent);
        let componentRef = componentFactory.create(this.injector, [], controlDiv);
        componentRef.instance.setMarker(this.locationMarker);
        componentRef.instance.angularBinding(componentRef.hostView);
        this.locationMarker.bindPopup(controlDiv);
        this.mapService.map.addLayer(this.accuracyCircle);
        this.mapService.map.addLayer(this.locationMarker);

        this.mapService.map.flyTo(latLng);
    }

    private disableGeoLocation() {
        if (this.isRecording()) {
            this.toggleRecording();
        }
        this.geoLocationService.disable();
        if (this.locationMarker != null) {
            this.mapService.map.removeLayer(this.locationMarker);
            this.locationMarker = null;
        }
        if (this.accuracyCircle != null) {
            this.mapService.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }
    }
}