import { Component, ApplicationRef, ViewEncapsulation } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material";
import * as _ from "lodash";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { OsmUserService } from "../../services/osm-user.service";
import { FileService } from "../../services/file.service";
import { IPointOfInterestExtended, PoiService, IRating, IRater } from "../../services/poi.service";
import { IconsService } from "../../services/icons.service";
import { MapService } from "../../services/map.service";
import { RouteLayerFactory } from "../../services/layers/routelayers/route-layer.factory";
import { ElevationProvider } from "../../services/elevation.provider";
import { UpdatePointDialogComponent } from "../dialogs/update-point-dialog.component";
import { ImageDialogCompnent } from "../dialogs/image-dialog.component";
import { IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";
import * as Common from "../../common/IsraelHiking";



@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poi-marker-popup.component.html",
    styleUrls: ["./poi-marker-popup.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    private static readonly THREE_HOURES = 3 * 60 * 60 * 1000;

    public description: string;
    public imagePreviewUrl: string;
    public url: string;
    public source: string;
    public type: string;
    public rating: number;
    public isLoading: boolean;
    public sourceImageUrl: string;
    private editMode: boolean;
    private extendedDataArrivedTimeStamp: Date;
    private poiExtended: IPointOfInterestExtended;
    private currentImageFile: File;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        applicationRef: ApplicationRef,
        private matDialog: MatDialog,
        elevationProvider: ElevationProvider,
        private toastService: ToastService,
        private routesService: RoutesService,
        private osmUserService: OsmUserService,
        private fileService: FileService,
        private poiService: PoiService,
        private mapService: MapService,
        private routeLayerFactory: RouteLayerFactory) {
        super(resources, httpClient, applicationRef, elevationProvider);
        this.editMode = false;
        this.isLoading = false;
        this.extendedDataArrivedTimeStamp = null;
        this.imagePreviewUrl = "";
        this.currentImageFile = null;
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

    public selectRoutes = (routesData: Common.RouteData[]): void => {
        throw new Error(`This function must be assigned by containing layer! ${routesData[0].name}`);
    };
    public clear = (): void => { throw new Error("This function must be assigned by the containing layer!") };

    public getDescrition(): string[] {
        if (this.description) {
            return this.description.split("\n");
        }
        if (!this.poiExtended || !this.poiExtended.isEditable) {
            return [""];
        }
        if (this.osmUserService.isLoggedIn() === false) {
            return [this.resources.noDescriptionLoginRequired];
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
            this.toastService.info(this.resources.loginRequired);
            return;
        }
        this.editMode = true;
    }

    public isRoute() {
        return this.poiExtended && this.poiExtended.isRoute;
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
        this.poiService.uploadPoint(this.poiExtended, this.currentImageFile).then((poiExtended: IPointOfInterestExtended) => {
            this.initFromPointOfInterestExtended(poiExtended);
            this.toastService.info(this.resources.dataUpdatedSuccefully);
        }, () => {
            this.toastService.error(this.resources.unableToSaveData);
        });
    }

    public voteUp() {
        this.vote(1);
    }

    public voteDown() {
        this.vote(-1);
    }

    public canVote(type: string): boolean {
        if (this.osmUserService.isLoggedIn() === false) {
            return false;
        }
        if (this.poiExtended == null) {
            return false;
        }
        let vote = _.find(this.poiExtended.rating.raters, r => r.id === this.osmUserService.userId);
        if (vote == null) {
            return true;
        }
        return type === "up" && vote.value < 0 || type === "down" && vote.value > 0;
    }

    private vote(value: number) {
        if (this.canVote(value > 0 ? "up" : "down") === false) {
            if (this.osmUserService.isLoggedIn() === false) {
                this.toastService.info(this.resources.loginRequired);
            }
            return;
        }
        this.poiExtended.rating.raters = this.poiExtended.rating.raters.filter(r => r.id !== this.osmUserService.userId);
        this.poiExtended.rating.raters.push({ id: this.osmUserService.userId, value: value } as IRater);
        this.poiService.uploadRating(this.poiExtended.rating).then((rating) => {
            this.poiExtended.rating = rating;
            this.rating = this.getRatingNumber(rating);
        });
    }

    public convertToRoute() {
        let routesCopy = JSON.parse(JSON.stringify(this.poiExtended.dataContainer.routes))  as Common.RouteData[];
        this.mapService.routesJsonToRoutesObject(routesCopy);
        routesCopy[0].description = this.description;
        this.routesService.setData(routesCopy);
        this.clear();
    }

    public addPointToRoute() {
        if (this.routesService.selectedRoute == null && this.routesService.routes.length > 0) {
            this.routesService.changeRouteState(this.routesService.routes[0]);
        }
        if (this.routesService.routes.length === 0) {
            let properties = this.routeLayerFactory.createRoute(this.routesService.createRouteName()).properties;
            this.routesService.addRoute({ properties: properties, segments: [], markers: [] });
        }
        let editMode = this.routesService.selectedRoute.getEditMode();
        this.routesService.selectedRoute.setHiddenState();
        var icon = this.poiExtended ? this.poiExtended.icon : "icon-star";
        this.routesService.selectedRoute.route.markers.push({
            latlng: this.latLng,
            title: this.title || this.description,
            type: icon.replace("icon-", ""),
            id: this.poiExtended.id,
            marker: null
        } as IMarkerWithData);
        this.routesService.selectedRoute.setEditMode(editMode);
    }

    private getPoiData() {
        if (this.poiExtended &&
            this.extendedDataArrivedTimeStamp != null &&
            Date.now() - this.extendedDataArrivedTimeStamp.getTime() < PoiMarkerPopupComponent.THREE_HOURES) {
            this.selectRoutes(this.poiExtended.dataContainer.routes);
            return;
        }
        this.isLoading = true;
        this.poiService.getPoint(this.marker.identifier, this.source, this.type).then((poiExtended) => {
            this.extendedDataArrivedTimeStamp = new Date();
            this.initFromPointOfInterestExtended(poiExtended);
            this.selectRoutes(this.poiExtended.dataContainer.routes);
            this.isLoading = false;
        }, () => {
            this.isLoading = false;
        });
    }

    public imageChanged(e: any) {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return;
        }
        this.currentImageFile = file;
        let reader = new FileReader();

        reader.onload = (event: any) => {
            this.imagePreviewUrl = event.target.result;
        }

        reader.readAsDataURL(file);
    }

    public openUpdatePointDialog(e: Event) {
        this.suppressEvents(e);
        let compoent = this.matDialog.open(UpdatePointDialogComponent);
        compoent.componentInstance.title = this.title;
        compoent.componentInstance.description = this.description;
        compoent.componentInstance.websiteUrl = this.url;
        compoent.componentInstance.imagesUrls = this.poiExtended.imagesUrls;
        compoent.componentInstance.location = this.marker.getLatLng();
        compoent.componentInstance.source = this.poiExtended.source;
        compoent.componentInstance.identifier = this.poiExtended.id;
        compoent.componentInstance.elementType = this.poiExtended.type;
        compoent.componentInstance.initialize(this.poiExtended.icon);

        compoent.afterClosed().subscribe((poiExtended: IPointOfInterestExtended) => {
            if (!poiExtended) {
                return;
            }
            this.initFromPointOfInterestExtended(poiExtended);
            this.marker.setIcon(IconsService.createPoiIcon(poiExtended.icon, poiExtended.iconColor));
            this.editMode = false;
        });
    }

    private getRatingNumber(rating: IRating): number {
        return _.sum(rating.raters.map(r => r.value));
    }

    public showImage() {
        let dialog = this.matDialog.open(ImageDialogCompnent);
        dialog.componentInstance.title = this.title;
        dialog.componentInstance.imagesUrls = [...this.poiExtended.imagesUrls];
        if (this.imagePreviewUrl && !this.poiExtended.imagesUrls.find(s => s === this.imagePreviewUrl)) {
            dialog.componentInstance.imagesUrls.splice(0, 0, this.imagePreviewUrl);
        }
    }

    public getOffRoadUrl() {
        if (!this.poiExtended) {
            return "";
        }
        return `http://off-road.io/track/${this.poiExtended.id}`;
    }

    private initFromPointOfInterestExtended = (poiExtended: IPointOfInterestExtended) => {
        this.poiExtended = poiExtended;
        this.description = poiExtended.description;
        this.url = poiExtended.url;
        this.imagePreviewUrl = poiExtended.imagesUrls.length > 0 ? poiExtended.imagesUrls[0] : "";
        this.sourceImageUrl = poiExtended.sourceImageUrl;
        this.rating = this.getRatingNumber(this.poiExtended.rating);
        this.mapService.routesJsonToRoutesObject(this.poiExtended.dataContainer.routes);
    }
}