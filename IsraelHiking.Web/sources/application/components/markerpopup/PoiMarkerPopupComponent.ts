import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { BaseMarkerPopupComponent } from "./BaseMarkerPopupComponent";
import { ResourcesService } from "../../services/ResourcesService";
import { ElevationProvider } from "../../services/ElevationProvider";
import { MapService } from "../../services/MapService";
import { IRouteLayer } from "../../services/layers/routelayers/IRouteLayer";
import { IconsService } from "../../services/IconsService";
import * as Common from "../../common/IsraelHiking";
import * as _ from "lodash";

interface IIconsGroup {
    icons: string[];
}

@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poiMarkerPopup.html"
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    private routeLayer: IRouteLayer;
    public showIcons: boolean;
    public markerType: string;
    public iconsGroups: IIconsGroup[];

    constructor(resources: ResourcesService,
        http: Http,
        elevationProvider: ElevationProvider,
        private mapService: MapService) {
        super(resources, http, elevationProvider);

        this.showIcons = false;
        this.iconsGroups = [];
        this.iconsGroups.push({
            icons: ["car", "bike", "hike", "four-by-four"]
        });
        this.iconsGroups.push({
            icons: ["arrow-left", "arrow-right", "tint", "star"]
        });
        this.iconsGroups.push({
            icons: ["bed", "binoculars", "fire", "flag"]
        });
        this.iconsGroups.push({
            icons: ["coffee", "cutlery", "shopping-cart", "tree"]
        });
    }

    public setMerkerType = (markerType: string): void => {
        this.markerType = markerType;
        let color = this.routeLayer.route.properties.pathOptions.color;
        this.marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, markerType));
    }

    public save = (newTitle: string, markerType: string) => {
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker);
        routeMarker.title = newTitle;
        routeMarker.type = markerType;
        let color = this.routeLayer.route.properties.pathOptions.color;
        this.mapService.setMarkerTitle(this.marker, newTitle, color);
        this.routeLayer.raiseDataChanged();
        this.marker.closePopup();
    }

    public getDirection(title: string) {
        if (!title) {
            return this.resources.direction;
        }
        if (title.match(/^[\u0590-\u05FF]/) != null) {
            return "rtl";
        }
        return "ltr";
    }

    public updateWikiCoordinates(title: string) {
        this.wikiCoordinatesString = this.getWikiCoordString(this.latLng, title);
    };

    public setRouteLayer(routeLayer: IRouteLayer) {
        this.routeLayer = routeLayer;
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);
        this.marker.on("popupopen", () => {
            let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker);
            this.latLng = routeMarker.latlng;
            this.markerType = routeMarker.type || "star";
            this.wikiCoordinatesString = this.getWikiCoordString(this.latLng, this.marker.title);
        });

        this.marker.on("popupclose", () => {
            let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker);
            let color = this.routeLayer.route.properties.pathOptions.color;
            this.marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, routeMarker.type));
        });
    }

    private getWikiCoordString(latlng: L.LatLng, title: string): string {
        return `{{Coord|${latlng.lat.toFixed(4)}|${latlng.lng.toFixed(4)}|display=${title}|type:landmark}}`;
    }
}