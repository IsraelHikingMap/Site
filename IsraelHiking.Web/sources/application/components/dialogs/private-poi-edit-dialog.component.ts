import { Component, ViewChild, ElementRef, AfterViewInit, HostListener } from "@angular/core";
import { Router } from "@angular/router";
import { MatDialogRef } from "@angular/material";
import { ENTER } from "@angular/cdk/keycodes";
import * as _ from "lodash";

import { IconsService } from "../../services/icons.service";
import { IMarkerWithData, IRouteLayer } from "../../services/layers/routelayers/iroute.layer";
import { MapService } from "../../services/map.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { ImageResizeService } from "../../services/image-resize.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import * as Common from "../../common/IsraelHiking";

interface IIconsGroup {
    icons: string[];
}

@Component({
    selector: "private-poi-edit-dialog",
    templateUrl: "private-poi-edit-dialog.component.html"
})
export class PrivatePoiEditDialogComponent extends BaseMapComponent implements AfterViewInit {
    private static readonly NUMBER_OF_ICONS_PER_ROW = 4;

    private routeLayer: IRouteLayer;
    private marker: Common.IMarkerWithTitle;
    public imageLink: Common.LinkData;

    public showIcons: boolean;
    public title: string;
    public markerType: string;
    public description: string;
    public iconsGroups: IIconsGroup[];

    @ViewChild("titleInput")
    public titleInput: ElementRef;

    constructor(resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly fileService: FileService,
        private readonly imageResizeService: ImageResizeService,
        private readonly privatePoiUploaderService: PrivatePoiUploaderService,
        private readonly dialogRef: MatDialogRef<PrivatePoiEditDialogComponent>) {
        super(resources);
        this.showIcons = false;
        this.iconsGroups = [];
        for (let iconTypeIndex = 0; iconTypeIndex < IconsService.getAvailableIconTypes().length /
            PrivatePoiEditDialogComponent.NUMBER_OF_ICONS_PER_ROW; iconTypeIndex++) {
            this.iconsGroups.push({
                icons: IconsService.getAvailableIconTypes().splice(
                    iconTypeIndex * PrivatePoiEditDialogComponent.NUMBER_OF_ICONS_PER_ROW,
                    PrivatePoiEditDialogComponent.NUMBER_OF_ICONS_PER_ROW)
            });
        }
    }

    public ngAfterViewInit(): void {
        setTimeout(() => {
            // this is to trigger changes otherwise there's an error: Expression has changed after it was checked
            this.focusTitle();
        }, 25);

    }

    private focusTitle() {
        if (this.titleInput && this.titleInput.nativeElement) {
            this.titleInput.nativeElement.focus();
        }
    }

    public setMarkerAndRoute(marker: Common.IMarkerWithTitle, routeLayer: IRouteLayer) {
        this.marker = marker;
        this.routeLayer = routeLayer;
        let routeMarker = _.find(routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        this.markerType = routeMarker.type;
        this.title = routeMarker.title;
        this.description = routeMarker.description;
        let url = _.find(routeMarker.urls, u => u.mimeType.startsWith("image"));
        this.imageLink = url;
    }

    public setMarkerType = (markerType: string): void => {
        this.markerType = markerType;
    }

    public save = () => {
        let routeMarker = _.find(this.routeLayer.route.markers, markerToFind => markerToFind.marker === this.marker) as IMarkerWithData;
        if (!routeMarker) {
            return;
        }
        routeMarker.title = this.title;
        routeMarker.type = this.markerType;
        routeMarker.description = this.description;
        if (this.imageLink) {
            routeMarker.urls = [this.imageLink];
        } else {
            routeMarker.urls = [];
        }
        let color = this.routeLayer.route.properties.pathOptions.color;
        this.mapService.setMarkerTitle(this.marker, routeMarker, color);
        this.marker.setIcon(IconsService.createMarkerIconWithColorAndType(color, routeMarker.type));
        this.routeLayer.raiseDataChanged();
    }

    public async addImage(e: any) {
        this.suppressEvents(e);
        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        let container = await this.imageResizeService.resizeImageAndConvert(file, false);
        this.imageLink = container.routes[0].markers[0].urls[0];
    }

    public clearImage() {
        this.imageLink = null;
    }

    public async uploadPoint(e: Event) {
        await this.privatePoiUploaderService.uploadPoint(
            this.marker,
            this.imageLink,
            this.title,
            this.description,
            this.markerType);
        this.dialogRef.close();
    }

    public remove: () => void = () => { throw new Error("Should be overridden in caller"); };

    @HostListener("window:keydown", ["$event"])
    public onEnterPress($event: KeyboardEvent) {
        if ($event.shiftKey) {
            return true;
        }
        if ($event.keyCode !== ENTER) {
            return true;
        }
        this.save();
        this.dialogRef.close();
        return false;
    }
}