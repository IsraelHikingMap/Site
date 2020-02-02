import { Component, Inject } from "@angular/core";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material";
import { NgRedux } from "@angular-redux/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { PrivatePoiEditDialogComponent } from "./private-poi-edit-dialog.component";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";
import { ApplicationState, MarkerData, LinkData } from "../../models/models";

@Component({
    selector: "private-poi-show-dialog",
    templateUrl: "private-poi-show-dialog.component.html"
})
export class PrivatePoiShowDialogComponent extends BaseMapComponent {

    private routeId: string;
    private index: number;

    public marker: MarkerData;
    public imageLink: LinkData;
    public url: LinkData;
    public title: string;
    public description: string;
    public showCoordinates: boolean;

    public static openDialog(matDialog: MatDialog, marker: MarkerData, routeId: string, index: number) {
        setTimeout(() => {
            // for some reason, in android, the click event gets called on the dialog, this is in order to prevent it.
            matDialog.open(PrivatePoiShowDialogComponent,
                {
                    maxWidth: "378px",
                    data: {
                        marker,
                        routeId,
                        index
                    }
                });
        }, 100);
    }

    constructor(resources: ResourcesService,
        private readonly matDialog: MatDialog,
        private readonly imageGalleryService: ImageGalleryService,
        private readonly privatePoiUploaderService: PrivatePoiUploaderService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>,
        private readonly dialogRef: MatDialogRef<PrivatePoiShowDialogComponent>,
        @Inject(MAT_DIALOG_DATA) data) {
        super(resources);

        this.marker = data.marker;
        this.routeId = data.routeId;
        this.index = data.index;
        this.title = this.marker.title;
        this.description = this.marker.description;
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
        this.url = this.marker.urls.find(u => !u.mimeType.startsWith("image"));
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

    public async uploadPoint() {
        await this.privatePoiUploaderService.uploadPoint(
            this.marker.latlng,
            this.imageLink,
            this.title,
            this.description,
            this.marker.type);
        this.dialogRef.close();
    }

    public addToActiveRoute() {
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: this.selectedRouteService.getSelectedRoute().id,
            markerData: JSON.parse(JSON.stringify(this.marker))
        }));
    }

    public isShowAddToActiveRoute(): boolean {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && this.routeId != selectedRoute.id;
    }
}
