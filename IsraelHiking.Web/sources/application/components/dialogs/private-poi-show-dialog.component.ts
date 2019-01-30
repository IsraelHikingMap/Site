import { Component, Inject } from "@angular/core";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { MarkerData, LinkData } from "../../models/models";
import { PrivatePoiEditDialogComponent } from "./private-poi-edit-dialog.component";

@Component({
    selector: "private-poi-show-dialog",
    templateUrl: "private-poi-show-dialog.component.html"
})
export class PrivatePoiShowDialogComponent extends BaseMapComponent {

    private marker: MarkerData;
    private routeId: string;
    private index: number;

    public imageLink: LinkData;
    public title: string;
    public description: string;
    public showCoordinates: boolean;

    public static openDialog(matDialog: MatDialog, marker: MarkerData, routeId: string, index: number) {
        matDialog.open(PrivatePoiShowDialogComponent, {
            maxWidth: "378px", data: {
                marker: marker,
                routeId: routeId,
                index: index
            }
        });
    }

    constructor(resources: ResourcesService,
        private readonly matDialog: MatDialog,
        private readonly imageGalleryService: ImageGalleryService,
        private readonly dialogRef: MatDialogRef<PrivatePoiShowDialogComponent>,
        @Inject(MAT_DIALOG_DATA) data) {
        super(resources);

        this.marker = data.marker;
        this.routeId = data.routeId;
        this.index = data.index;
        this.title = this.marker.title;
        this.description = this.marker.description;
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
    }

    public toggleCoordinates() {
        this.showCoordinates = !this.showCoordinates;
    }

    public showImage() {
        this.imageGalleryService.setImages([this.imageLink.url]);
    }

    public edit() {
        this.dialogRef.close();
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, this.marker, this.routeId, this.index);
    }
}