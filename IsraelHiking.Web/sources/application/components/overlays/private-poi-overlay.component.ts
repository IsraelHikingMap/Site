import { Component, Input, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material";
import { NgRedux } from "@angular-redux/store";

import { MarkerData, LinkData, ApplicationState } from "../../models/models";
import { AuthorizationService } from "../../services/authorization.service";
import { ResourcesService } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { SetSelectedRouteAction } from "../../reducres/route-editing-state.reducer";
import { ChangeEditStateAction } from "../../reducres/routes.reducer";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";

@Component({
    selector: "private-poi-overlay",
    templateUrl: "./private-poi-overlay.component.html",
    styleUrls: ["./private-poi-overlay.component.scss"]
})
export class PrivatePoiOverlayComponent extends BaseMapComponent implements OnInit {

    // HM TODO: ihm coordinates, altitude?

    @Input()
    public marker: MarkerData;

    @Input()
    public routeId: string;

    @Input()
    public index: number;

    public imageLink: LinkData;

    public isExpanded: boolean;
    public hasExtraData: boolean;
    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
        private readonly matDialog: MatDialog,
        private readonly authorizationService: AuthorizationService,
        private readonly privatePoiUploaderService: PrivatePoiUploaderService,
        private readonly imageGalleryService: ImageGalleryService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.isExpanded = false;
        this.hasExtraData = false;
        this.hideCoordinates = true;
    }

    public ngOnInit(): void {
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
        this.hasExtraData = !!this.marker.description || this.imageLink != null;
    }

    public expand() {
        this.isExpanded = true;
    }

    public collapse() {
        this.isExpanded = false;
    }

    public showUploadPointButton(): boolean {
        return this.authorizationService.isLoggedIn();
    }

    public async uploadPoint() {
        await await this.privatePoiUploaderService.uploadPoint(
            this.marker.latlng,
            this.imageLink,
            this.marker.title,
            this.marker.description,
            this.marker.type);
    }

    public showImage() {
        if (this.imageLink && this.imageLink.url) {
            this.imageGalleryService.setImages([this.imageLink.url]);
        }
    }

    public changeToEditMode() {
        this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: this.routeId }));
        this.ngRedux.dispatch(new ChangeEditStateAction({ routeId: this.routeId, state: "Poi" }));
        let dialogRef = this.matDialog.open(PrivatePoiEditDialogComponent);
        dialogRef.componentInstance.setMarkerAndRoute(this.marker, this.routeId, this.index);
    }
}