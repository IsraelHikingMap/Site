import { Component, ElementRef, AfterViewInit, HostListener, inject, viewChild } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { NgStyle } from "@angular/common";
import { MatButton, MatAnchor, MatIconButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatFormField, MatLabel, MatSuffix } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatTooltip } from "@angular/material/tooltip";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { Share } from "@capacitor/share";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { CoordinatesComponent } from "../coordinates.component";
import { AddSimplePoiDialogComponent } from "./add-simple-poi-dialog.component";
import { ImageCaptureDirective } from "../../directives/image-capture.directive";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { ImageResizeService } from "../../services/image-resize.service";
import { NavigateHereService } from "../../services/navigate-here.service";
import { RunningContextService } from "../../services/running-context.service";
import { HashService } from "../../services/hash.service";
import { ToastService } from "../../services/toast.service";
import { PrivatePoiUploaderService } from "../../services/private-poi-uploader.service";
import { UpdatePrivatePoiAction, DeletePrivatePoiAction } from "../../reducers/routes.reducer";
import { DeleteRecordingPoiAction, UpdateRecordingPoiAction } from "../../reducers/recorded-route.reducer";
import { Urls } from "../../urls";
import type { LinkData, MarkerDataWithoutId, ApplicationState, MarkerData } from "../../models";

interface IIconsGroup {
    icons: string[];
}

interface PrivatePoiEditDialogData {
    marker: Immutable<MarkerDataWithoutId>;
    routeId?: string;
    index: number;
}

@Component({
    selector: "private-poi-edit-dialog",
    templateUrl: "private-poi-edit-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatAnchor, ImageCaptureDirective, Angulartics2OnModule, MatTooltip, NgStyle, MatIconButton, MatSuffix, CoordinatesComponent, MatDialogActions, MatMenu, MatMenuItem, MatMenuTrigger]
})
export class PrivatePoiEditDialogComponent implements AfterViewInit {
    private static readonly NUMBER_OF_ICONS_PER_ROW = 4;

    private routeId?: string;
    private markerIndex: number;

    public marker: MarkerData;
    public url: LinkData;
    public imageLink: LinkData;
    public showIcons: boolean = false;
    public showCoordinates: boolean = false;
    public showUrl: boolean;
    public title: string;
    public markerType: string;
    public description: string;
    public iconsGroups: IIconsGroup[] = [];

    public titleInput = viewChild<ElementRef>("titleInput");

    public readonly resources = inject(ResourcesService);

    private readonly fileService = inject(FileService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly matDialog = inject(MatDialog);
    private readonly dialogRef = inject(MatDialogRef);
    private readonly navigateHereService = inject(NavigateHereService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly hashService = inject(HashService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    private readonly privatePoiUploaderService = inject(PrivatePoiUploaderService);
    private readonly data = inject<PrivatePoiEditDialogData>(MAT_DIALOG_DATA);


    constructor() {
        this.iconsGroups = [];
        const icons = [
            "star", "arrow-left", "arrow-right", "tint",
            "automobile", "bike", "hike", "four-by-four",
            "bed", "viewpoint", "fire", "flag",
            "coffee", "cutlery", "shopping-cart", "tree"
        ];
        const groups = icons.length / PrivatePoiEditDialogComponent.NUMBER_OF_ICONS_PER_ROW;
        for (let iconTypeIndex = 0;
            iconTypeIndex < groups;
            iconTypeIndex++) {
            this.iconsGroups.push({
                icons: icons.splice(0, PrivatePoiEditDialogComponent.NUMBER_OF_ICONS_PER_ROW)
            });
        }
        this.routeId = this.data.routeId;
        this.markerIndex = this.data.index;
        this.marker = structuredClone(this.data.marker) as MarkerData;
        this.markerType = this.marker.type;
        this.title = this.marker.title;
        this.description = this.marker.description;
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
        this.url = this.marker.urls.find(u => !u.mimeType.startsWith("image"));
        this.showUrl = this.url != null;
    }

    /**
     * Opens an edit marker dialog for both private routes and recording route
     *
     * @param matDialog dialog service
     * @param marker the makrer data to edit
     * @param index the index of the marker in the markers' array
     * @param routeId [optinal] - in case of null this dialog will edit recorded route markers, otherwise the id of the planned route
     */
    public static openDialog(matDialog: MatDialog, marker: Immutable<MarkerDataWithoutId>, index: number, routeId?: string) {
        setTimeout(() => {
            // for some reason, in android, the click event gets called on the dialog, this is in order to prevent it.
            matDialog.open(PrivatePoiEditDialogComponent, {
                maxWidth: "378px",
                data: {
                    marker,
                    index,
                    routeId
                } as PrivatePoiEditDialogData
            });
        }, 100);
    }

    public ngAfterViewInit(): void {
        setTimeout(() => {
            // this is to trigger changes otherwise there's an error: Expression has changed after it was checked
            this.focusTitle();
        }, 25);
    }

    public toggleCoordinates() {
        this.showCoordinates = !this.showCoordinates;
    }

    private focusTitle() {
        if (this.titleInput && this.titleInput().nativeElement) {
            this.titleInput().nativeElement.focus();
        }
    }

    public setMarkerType(markerType: string): void {
        this.markerType = markerType;
    }

    public save() {
        const urls = [];
        if (this.imageLink) {
            urls.push(this.imageLink);
        }
        if (this.url && this.url.url) {
            this.url.text = this.title;
            urls.push(this.url);
        }
        const updatedMarker: MarkerData = {
            id: this.marker.id,
            title: this.title,
            description: this.description,
            latlng: this.marker.latlng,
            type: this.markerType,
            urls,
        };

        if (this.routeId) {
            this.store.dispatch(new UpdatePrivatePoiAction(this.routeId, this.markerIndex, updatedMarker));
        } else {
            this.store.dispatch(new UpdateRecordingPoiAction(this.markerIndex, updatedMarker));
        }
    }

    public async addImage(e: any) {
        const file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        const container = await this.imageResizeService.resizeImageAndConvert(file, false);
        this.imageLink = container.routes[0].markers[0].urls[0];
    }

    public clearImage() {
        this.imageLink = null;
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
                this.markerType);
        } else {
            AddSimplePoiDialogComponent.openDialog(this.matDialog, {
                id: this.marker.id,
                latlng: this.marker.latlng,
                imageLink: this.imageLink,
                title: this.title,
                description: this.description,
                markerType: this.markerType
            });
        }

        this.dialogRef.close();
    }

    public remove() {
        if (this.routeId) {
            this.store.dispatch(new DeletePrivatePoiAction(this.routeId, this.markerIndex));
        } else {
            this.store.dispatch(new DeleteRecordingPoiAction(this.markerIndex));
        }
    }

    public addUrl() {
        this.showUrl = true;
        if (this.url == null) {
            this.url = {
                text: this.title,
                mimeType: "text/html",
                url: ""
            };
        }

    }

    public removeUrl() {
        this.url = null;
    }

    public async navigateHere() {
        await this.navigateHereService.addNavigationSegment(this.marker.latlng, this.title);
    }

    public canShareLocation() {
        return this.runningContextService.isCapacitor;
    }

    public shareLocation() {
        const coordinateUrl = this.hashService.getFullUrlFromLatLng(this.marker.latlng);
        Share.share({
            text: `geo:${this.marker.latlng.lat},${this.marker.latlng.lng}\n${coordinateUrl}`
        });
    }

    public getWazeAddress() {
        return `${Urls.waze}${this.marker.latlng.lat},${this.marker.latlng.lng}`;
    }

    @HostListener("window:keydown", ["$event"])
    public onEnterPress($event: KeyboardEvent) {
        if ($event.shiftKey) {
            return true;
        }
        if ($event.key !== "Enter") {
            return true;
        }
        this.save();
        this.dialogRef.close();
        return false;
    }
}
