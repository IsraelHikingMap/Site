import { Component, ApplicationRef, ViewEncapsulation } from "@angular/core";
import { Http } from "@angular/http";
import { MdDialog, MdSelectChange } from "@angular/material";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { OsmUserService } from "../../services/osm-user.service";
import { FileService } from "../../services/file.service";
import { IPointOfInterestExtended, PoiService, IRating, IRater } from "../../services/poi.service";
import { IconsService } from "../../services/icons.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { GeoJsonParser } from "../../services/geojson.parser";
import { UpdatePointDialogComponent } from "../dialogs/update-point-dialog.component";
import { ImageDialogCompnent } from "../dialogs/image-dialog.component";
import * as Common from "../../common/IsraelHiking";


@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poi-marker-popup.component.html",
    encapsulation: ViewEncapsulation.None
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    private static readonly THREE_HOURES = 3 * 60 * 60 * 1000;

    public description: string;
    public thumbnail: string;
    public address: string;
    public source: string;
    public rating: number;
    public isLoading: boolean;
    private editMode: boolean;
    private routeData: Common.RouteData;
    private extendedDataArrivedTimeStamp: Date;
    private poiExtended: IPointOfInterestExtended;

    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        private mdDialog: MdDialog,
        elevationProvider: ElevationProvider,
        private geoJsonParser: GeoJsonParser,
        private toastService: ToastService,
        private routesService: RoutesService,
        private osmUserService: OsmUserService,
        private fileService: FileService,
        private poiService: PoiService) {
        super(resources, http, applicationRef, elevationProvider);
        this.editMode = false;
        this.isLoading = false;
        this.extendedDataArrivedTimeStamp = null;
    }

    protected setMarkerInternal = (marker: Common.IMarkerWithTitle) => {
        this.marker = marker;
        this.title = marker.title;
        this.latLng = marker.getLatLng();
        this.marker.on("popupopen", () => {
            this.getPoiData();
        });
        this.marker.on("popupclose", () => {
            if (this.editMode) {
                this.toastService.info(this.resources.closeWhileInEditMode);
            }
            this.editMode = false;
        });
    }

    public selectRoute = (routeData: Common.RouteData): void => {
        console.log(routeData);
        throw new Error("This function must be assigned by containing layer!");
    };
    public clearSelectedRoute = (): void => { throw new Error("This function must be assigned by the containing layer!") };

    public getDescrition(): string[] {
        if (this.description) {
            return this.description.split("\n");
        }
        if (!this.poiExtended || !this.poiExtended.isEditable) {
            return [""];
        }
        if (this.osmUserService.isLoggedIn() === false) {
            return [this.resources.loginRequired];
        }
        return [this.resources.emptyPoiDescription];
    }

    public isHideEditMode(): boolean {
        return !this.osmUserService.isLoggedIn() ||
            !this.poiExtended ||
            !this.poiExtended.isEditable ||
            this.editMode;
    }

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        if (this.osmUserService.isLoggedIn() === false) {
            this.osmUserService.login();
            return;
        }
        this.editMode = true;
    }

    public canBeConvertedToRoute() {
        return this.routeData && this.routeData.segments.length > 0;
    }

    public getIcon() {
        if (this.poiExtended && this.poiExtended.isEditable === false) {
            return this.poiExtended.icon;
        }
        return "icon-camera";
    }

    public save() {
        this.editMode = false;
        this.poiExtended.description = this.description;
        this.poiExtended.imageUrl = this.thumbnail;
        this.poiService.uploadPoint(this.poiExtended).then(() => {
            this.toastService.info(this.resources.dataUpdatedSuccefully);
        });
    }

    public voteUp() {
        this.vote(1);
    }

    public voteDown() {
        this.vote(-1);
    }

    public canVote(): boolean {
        if (this.osmUserService.isLoggedIn() === false) {
            return false;
        }
        if (this.poiExtended == null) {
            return false;
        }
        return this.poiExtended.rating.raters.filter(r => r.id === this.osmUserService.userId).length === 0;
    }

    private vote(value: number) {
        if (this.canVote() === false) {
            if (this.osmUserService.isLoggedIn() === false) {
                this.toastService.info(this.resources.loginRequired);
            }
            return;
        }
        this.poiExtended.rating.raters.push({ id: this.osmUserService.userId, value: value } as IRater);
        this.poiService.uploadRating(this.poiExtended.rating).then((response) => {
            let rating = response.json() as IRating;
            this.poiExtended.rating = rating;
            this.rating = this.getRatingNumber(rating);
        });
    }

    public convertToRoute() {
        this.routeData.description = this.description;
        this.routesService.setData([this.routeData]);
        this.clearSelectedRoute();
        this.marker.closePopup();
    }

    private getPoiData() {
        if (this.extendedDataArrivedTimeStamp != null &&
            Date.now() - this.extendedDataArrivedTimeStamp.getTime() < PoiMarkerPopupComponent.THREE_HOURES) {
            this.selectRoute(this.routeData);
            return;
        }
        this.isLoading = true;
        this.poiService.getPoint(this.marker.identifier, this.source).then((response) => {
            this.extendedDataArrivedTimeStamp = new Date();
            let poiExtended = response.json() as IPointOfInterestExtended;
            this.poiExtended = poiExtended;
            this.description = poiExtended.description;
            this.address = poiExtended.url;
            this.thumbnail = poiExtended.imageUrl;
            this.rating = this.getRatingNumber(poiExtended.rating);
            var container = this.geoJsonParser.toDataContainer(poiExtended.featureCollection,
                this.resources.getCurrentLanguageCodeSimplified());
            this.routeData = container.routes[0];
            this.selectRoute(this.routeData);
            this.isLoading = false;
        });
    }

    public uploadImage(e: any) {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return;
        }
        this.fileService.uploadImage(file, this.title, this.marker.getLatLng()).then((imageUrl: string) => {
            this.thumbnail = imageUrl;
        }, () => {
            this.toastService.error(this.resources.unableToUploadFile);
        });
    }

    public openUpdatePointDialog(e: Event) {
        this.suppressEvents(e);
        let compoent = this.mdDialog.open(UpdatePointDialogComponent);
        compoent.componentInstance.title = this.title;
        compoent.componentInstance.description = this.description;
        compoent.componentInstance.imageUrl = this.thumbnail;
        compoent.componentInstance.websiteUrl = this.address;
        compoent.componentInstance.location = this.marker.getLatLng();
        compoent.componentInstance.source = this.poiExtended.source;
        compoent.componentInstance.identifier = this.poiExtended.id;
        compoent.componentInstance.initializationPromise.then(() => {
            for (let category of compoent.componentInstance.categories) {
                let icon = _.find(category.icons, iconToFind => iconToFind.icon === this.poiExtended.icon);
                if (icon) {
                    compoent.componentInstance.selectCategory({ value: category } as MdSelectChange);
                    compoent.componentInstance.selectIcon(icon);
                    break;
                }
            }
        });
        compoent.afterClosed().subscribe((poiExtended: IPointOfInterestExtended) => {
            if (!poiExtended) {
                return;
            }
            this.poiExtended = poiExtended;
            this.title = poiExtended.title;
            this.description = poiExtended.description;
            this.thumbnail = poiExtended.imageUrl;
            this.address = poiExtended.url;
            this.rating = this.getRatingNumber(poiExtended.rating);
            this.marker.setIcon(IconsService.createPoiIcon(poiExtended.icon, poiExtended.iconColor));
            this.editMode = false;
        });
    }

    private getRatingNumber(rating: IRating): number {
        return _.sum(rating.raters.map(r => r.value));
    }

    public showImage() {
        let dialog = this.mdDialog.open(ImageDialogCompnent);
        dialog.componentInstance.title = this.title;
        dialog.componentInstance.imageUrl = this.thumbnail;
    }
}