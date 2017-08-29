import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import { MdDialog } from "@angular/material";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { MapService } from "../../services/map.service";
import { IRouteLayer } from "../../services/layers/routelayers/iroute.layer";
import { IconsService } from "../../services/icons.service";
import { OsmUserService } from "../../services/osm-user.service";
import { UpdatePointDialogComponent } from "../dialogs/update-point-dialog.component";
import * as Common from "../../common/IsraelHiking";



interface IIconsGroup {
    icons: string[];
}

@Component({
    selector: "drawing-poi-marker-popup",
    templateUrl: "./drawing-poi-marker-popup.component.html"
})
export class DrawingPoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    private routeLayer: IRouteLayer;
    public showIcons: boolean;
    public markerType: string;
    public wikiCoordinatesString: string;
    public iconsGroups: IIconsGroup[];

    constructor(resources: ResourcesService,
        http: Http,
        private mdDialog: MdDialog,
        elevationProvider: ElevationProvider,
        applicationRef: ApplicationRef,
        private mapService: MapService,
        private osmUserService: OsmUserService) {
        super(resources, http, applicationRef, elevationProvider);

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

    public showOpenDialogButton(): boolean {
        return this.osmUserService.isLoggedIn();
    }

    public openAddPointDialog(e: Event) {
        this.suppressEvents(e);
        let compoent = this.mdDialog.open(UpdatePointDialogComponent);
        compoent.componentInstance.title = this.title;
        compoent.componentInstance.source = "OSM";
        compoent.componentInstance.location = this.marker.getLatLng();
        for (let group of compoent.componentInstance.categoriesTypeGroups) {
            let category = _.find(group.categories, iconToFind => iconToFind.icon === this.markerType);
            if (category) {
                compoent.componentInstance.selectCategory(category);
            }    
        }
        
    }
}