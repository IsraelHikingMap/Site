import { Component, ApplicationRef, HostListener, ViewChild, ElementRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material";
import { ENTER } from "@angular/cdk/keycodes";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { MapService } from "../../services/map.service";
import { IRouteLayer, IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";
import { IconsService } from "../../services/icons.service";
import { OsmUserService } from "../../services/osm-user.service";
import { FileService } from "../../services/file.service";
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
    public description: string;
    public imageUrl: string;
    public wikiCoordinatesString: string;
    public iconsGroups: IIconsGroup[];
    public isEditMode: boolean;
    
    @ViewChild("titleInput")
    public titleInput: ElementRef;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        private matDialog: MatDialog,
        elevationProvider: ElevationProvider,
        applicationRef: ApplicationRef,
        private mapService: MapService,
        private osmUserService: OsmUserService,
        private fileService: FileService) {
        super(resources, httpClient, applicationRef, elevationProvider);

        this.showIcons = false;
        this.wikiCoordinatesString = "";
        this.iconsGroups = [];
        this.isEditMode = false;
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

    public save = () => {
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        if (!routeMarker) {
            return;
        }
        routeMarker.title = this.title;
        routeMarker.type = this.markerType;
        routeMarker.description = this.description;
        if (this.imageUrl) {
            routeMarker.urls = [
                {
                    mimeType: `image/${this.imageUrl.split(".").pop()}`,
                    url: this.imageUrl,
                    text: ""
                }
            ];
        } else {
            routeMarker.urls = [];
        }
        let color = this.routeLayer.route.properties.pathOptions.color;
        this.mapService.setMarkerTitle(this.marker, this.title, color);
        this.routeLayer.raiseDataChanged();
        this.marker.closePopup();
    }

    public updateWikiCoordinates() {
        this.wikiCoordinatesString = this.getWikiCoordString(this.latLng, this.title);
    };

    public setRouteLayer(routeLayer: IRouteLayer) {
        this.routeLayer = routeLayer;
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        this.markerType = routeMarker.type;
        this.description = routeMarker.description;
        var url = _.first(routeMarker.urls, u => u.type.startsWith("image")) || {};
        this.imageUrl = url.url;
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

        this.marker.on("popupopen", () => {
            if (this.titleInput && this.titleInput.nativeElement) {
                this.titleInput.nativeElement.focus();
            }
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
        let compoent = this.matDialog.open(UpdatePointDialogComponent);
        compoent.componentInstance.title = this.title;
        compoent.componentInstance.source = "OSM";
        compoent.componentInstance.elementType = "node";
        compoent.componentInstance.location = this.marker.getLatLng();
        compoent.componentInstance.identifier = this.marker.identifier;
        compoent.componentInstance.description = this.description;
        compoent.componentInstance.imagesUrls = [this.imageUrl];
        compoent.componentInstance.initialize(`icon-${this.markerType}`);
    }

    public async imageChanged(e: any) {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return;
        }
        let link = await this.fileService.uploadAnonymousImage(file);
        this.imageUrl = link;
    }

    public changeToEditMode = (): void => { throw new Error("Callback needs to be set by the creating class...")}

    @HostListener("window:keydown", ["$event"])
    public onEnterPress($event: KeyboardEvent) {
        if ($event.shiftKey) {
            return true;
        }
        if ($event.keyCode !== ENTER) {
            return true;
        }
        this.save();
        return false;
    }
}