import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";

import { MatButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatTooltip } from "@angular/material/tooltip";
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";
import { Store } from "@ngxs/store";

import { CoordinatesComponent } from "../coordinates.component";
import { AddSimplePoiDialogComponent } from "./add-simple-poi-dialog.component";
import { PrivatePoiEditDialogComponent } from "./private-poi-edit-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { ToastService } from "../../services/toast.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import type { ApplicationState, MarkerData, LinkData } from "../../models";

interface IPrivatePoiShowDialogData {
    marker: MarkerData;
    routeId: string;
    index: number;
}

@Component({
    selector: "private-poi-show-dialog",
    templateUrl: "private-poi-show-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, CoordinatesComponent, MatDialogActions, Angulartics2OnModule, MatTooltip]
})
export class PrivatePoiShowDialogComponent {

    private routeId: string;
    private index: number;

    public marker: MarkerData;
    public imageLink: LinkData;
    public url: LinkData;
    public title: string;
    public description: string;
    public showCoordinates: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly matDialog = inject(MatDialog);
    private readonly imageGalleryService = inject(ImageGalleryService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    private readonly dialogRef = inject(MatDialogRef);
    private readonly privatePoiUploaderService = inject(PrivatePoiUploaderService);
    private readonly data = inject<IPrivatePoiShowDialogData>(MAT_DIALOG_DATA);

    constructor() {

        this.marker = this.data.marker;
        this.routeId = this.data.routeId;
        this.index = this.data.index;
        this.title = this.marker.title;
        this.description = this.marker.description;
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
        this.url = this.marker.urls.find(u => !u.mimeType.startsWith("image"));
    }

    public static openDialog(dialog: MatDialog, marker: MarkerData, routeId: string, index: number) {
        setTimeout(() => {
            // for some reason, in android, the click event gets called on the dialog, this is in order to prevent it.
            dialog.open(PrivatePoiShowDialogComponent,
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
        if (this.title || this.description || this.imageLink) {
            await this.privatePoiUploaderService.uploadPoint(
                this.marker.id,
                this.marker.latlng,
                this.imageLink,
                this.title,
                this.description,
                this.marker.type);
        } else {
            AddSimplePoiDialogComponent.openDialog(this.matDialog, {
                id: this.marker.id,
                latlng: this.marker.latlng,
                imageLink: this.imageLink,
                title: this.title,
                description: this.description,
                markerType: this.marker.type
            });
        }
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
