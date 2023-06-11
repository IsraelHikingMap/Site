import { Component, Inject } from "@angular/core";
import {
    MatDialog,
    MatDialogRef,
    MAT_DIALOG_DATA
} from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { AddSimplePoiDialogComponent } from "./add-simple-poi-dialog.component";
import { PrivatePoiEditDialogComponent } from "./private-poi-edit-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ToastService } from "../../services/toast.service";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import type { ApplicationState, MarkerData, LinkData } from "../../models/models";

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

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly imageGalleryService: ImageGalleryService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly toastService: ToastService,
                private readonly store: Store,
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

    public toggleCoordinates() {
        this.showCoordinates = !this.showCoordinates;
    }

    public showImage() {
        this.imageGalleryService.open([this.imageLink.url], 0);
    }

    public edit() {
        this.dialogRef.close();
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, this.marker, this.index, this.routeId);
    }

    public async uploadPoint() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo == null) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
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
        this.store.dispatch(new AddPrivatePoiAction(this.selectedRouteService.getSelectedRoute().id, structuredClone(this.marker)));
    }

    public isShowAddToActiveRoute(): boolean {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && this.routeId !== selectedRoute.id;
    }
}
