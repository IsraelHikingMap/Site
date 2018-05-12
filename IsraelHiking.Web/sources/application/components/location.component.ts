import { Component, ComponentFactoryResolver, Injector } from "@angular/core";
import * as L from "leaflet";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { GeoLocationService } from "../services/geo-location.service";
import { ToastService } from "../services/toast.service";
import { MapService } from "../services/map.service";
import { GpsLocationMarkerPopupComponent } from "./markerpopup/gps-location-marker-popup.component";
import { IconsService } from "../services/icons.service";
import * as Common from "../common/IsraelHiking";


@Component({
    selector: "location-control",
    templateUrl: "./location.component.html",
    styleUrls: ["./location.component.css"]
})
export class LocationComponent extends BaseMapComponent {

    private locationMarker: Common.IMarkerWithTitle;
    private accuracyCircle: L.Circle;

    constructor(resources: ResourcesService,
        private readonly injector: Injector,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly mapService: MapService,
        private readonly geoLocationService: GeoLocationService,
        private readonly toastService: ToastService) {
        super(resources);

        this.locationMarker = null;
        this.accuracyCircle = null;

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
        if (this.isActive()) {
            this.disableGeoLocation();
        } else {
            this.geoLocationService.enable();
        }
    }

    public isActive() {
        return this.geoLocationService.getState() !== "disabled";
    }

    public isLoading() {
        return this.geoLocationService.getState() === "searching";
    }

    private updateMarkerPosition(position: Position) {
        let latLng = L.latLng(position.coords.latitude, position.coords.longitude);
        let radius = position.coords.accuracy;
        if (this.locationMarker == null) {
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
            componentRef.instance.remove = () => {
                // HM TODO: do we need this?
                // this.removeLocationMarker();
                // this.geoLocationService.disable();
            };
            this.locationMarker.bindPopup(controlDiv);
            this.mapService.map.addLayer(this.accuracyCircle);
            this.mapService.map.addLayer(this.locationMarker);

            this.mapService.map.flyTo(latLng);
        } else {
            this.locationMarker.setLatLng(latLng);
            this.accuracyCircle.setLatLng(latLng).setRadius(radius);
        }
    }

    private disableGeoLocation() {
        this.geoLocationService.disable();
        this.mapService.map.removeLayer(this.locationMarker);
        this.mapService.map.removeLayer(this.accuracyCircle);
        this.locationMarker = null;
        this.accuracyCircle = null;
    }
}