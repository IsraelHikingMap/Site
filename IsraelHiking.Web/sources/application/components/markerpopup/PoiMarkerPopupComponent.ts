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
    public wikiCoordinatesString: string;
    public iconsGroups: IIconsGroup[];

    constructor(resources: ResourcesService,
        http: Http,
        elevationProvider: ElevationProvider,
        private mapService: MapService) {
        super(resources, http, elevationProvider);

        this.showIcons = false;
        this.wikiCoordinatesString = "";
        this.iconsGroups = [];
        let numberOfIconsPerRow = 4;
        for (let iconTypeIndex = 0; iconTypeIndex < IconsService.getAvailableIconTypes().length / numberOfIconsPerRow; iconTypeIndex++) {
            this.iconsGroups.push({
                icons: IconsService.getAvailableIconTypes().splice(iconTypeIndex * numberOfIconsPerRow, numberOfIconsPerRow)
            });
        }
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

    public updateWikiCoordinates() {
        this.wikiCoordinatesString = this.getWikiCoordString(this.latLng, this.title);
    };

    public setRouteLayer(routeLayer: IRouteLayer) {
        this.routeLayer = routeLayer;
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker);
        this.markerType = routeMarker.type;
        this.updateWikiCoordinates();
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);

        this.marker.on("dragend", () => {
            this.updateWikiCoordinates();
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