import { Component, Inject } from "@angular/core";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";

import { BaseMapComponent } from "../base-map.component";
import { AddSimplePoiDialogComponent } from "./add-simple-poi-dialog.component";
import { PrivatePoiEditDialogComponent } from "./private-poi-edit-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { NgRedux } from "../../reducers/infra/ng-redux.module";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import { ApplicationState, MarkerData, LinkData } from "../../models/models";

interface IPrivatePoiShowDialogData {
    marker: MarkerData;
    routeId: string;
    index: number;
}

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
                    } as IPrivatePoiShowDialogData
                });
        }, 100);
    }

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly imageGalleryService: ImageGalleryService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly ngRedux: NgRedux<ApplicationState>,
                private readonly dialogRef: MatDialogRef<PrivatePoiShowDialogComponent>,
                @Inject(MAT_DIALOG_DATA) data: IPrivatePoiShowDialogData) {
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
        this.imageGalleryService.open([this.imageLink.url], 0);
    }

    public edit() {
        this.dialogRef.close();
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, this.marker, this.routeId, this.index);
    }

    public async uploadPoint() {
        AddSimplePoiDialogComponent.openDialog(this.matDialog,
            {
                latlng: this.marker.latlng,
                imageLink: this.imageLink,
                title: this.title,
                description: this.description,
                markerType: this.marker.type
            });
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
        return selectedRoute != null && this.routeId !== selectedRoute.id;
    }
}
