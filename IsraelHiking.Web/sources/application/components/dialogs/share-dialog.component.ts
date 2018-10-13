﻿import { Component, AfterViewInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";

import { LocalStorage } from "ngx-store";
import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { OsmUserService } from "../../services/osm-user.service";
import { ToastService } from "../../services/toast.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { DataContainerService } from "../../services/data-container.service";
import { BaseMapComponent } from "../base-map.component";
import { ShareUrl } from "../../models/share-url";
import { DataContainer } from "../../models/models";

export interface IIOffroadCoordinates {
    latitude: number;
    longitude: number;
    altitude: number;
}

export interface IOffroadPostRequest {
    userMail: string;
    title: string;
    description: string;
    activityType: string;
    difficultyLevel: string;
    sharingCode: number;
    backgroundServeUrl: string;
    path: IIOffroadCoordinates[];
    mapItems: IIOffroadMarker[];
    externalUrl: string;
}

export interface IIOffroadMarker {
    title: string;
    description: string;
    visibilityLevel: string;
    mapItemType: string;
    point: IIOffroadCoordinates;
}

@Component({
    selector: "share-dialog",
    templateUrl: "./share-dialog.component.html"
})
export class ShareDialogComponent extends BaseMapComponent implements AfterViewInit {

    public title: string;
    public description: string;
    public imageUrl: string;
    public shareAddress: string;
    public whatsappShareAddress: SafeUrl;
    public facebookShareAddress: string;
    public nakebCreateHikeAddress: string;
    public isLoading: boolean;
    public lastShareUrl: ShareUrl;
    public offroadRequest: IOffroadPostRequest;
    public showOffroadForm: boolean;
    public offroadPublicTrack: boolean;
    public canUpdate: boolean;
    public updateCurrentShare: boolean;

    @LocalStorage()
    public storedUserEmail = "";

    constructor(resources: ResourcesService,
        private readonly httpClient: HttpClient,
        private readonly sanitizer: DomSanitizer,
        private readonly mapService: MapService,
        private readonly routesService: RoutesService,
        private readonly dataContainerService: DataContainerService,
        private readonly osmUserService: OsmUserService,
        private readonly toastService: ToastService,
    ) {
        super(resources);

        this.osmUserService = osmUserService;
        this.title = "";
        this.description = "";
        this.imageUrl = "";
        this.isLoading = false;
        this.showOffroadForm = false;
        this.shareAddress = "";
        this.whatsappShareAddress = null;
        this.facebookShareAddress = "";
        this.nakebCreateHikeAddress = "";
        this.lastShareUrl = null;
        let shareUrl = this.dataContainerService.getShareUrl();
        this.canUpdate = shareUrl != null &&
            this.osmUserService.shareUrls.find(s => s.id === shareUrl.id) != null &&
            this.osmUserService.isLoggedIn();
        this.updateCurrentShare = false;
        this.offroadPublicTrack = false;
        this.offroadRequest = {} as IOffroadPostRequest;
        this.offroadRequest.userMail = this.storedUserEmail;
        this.offroadRequest.activityType = "OffRoading";
        this.offroadRequest.difficultyLevel = "3";
        if (shareUrl != null) {
            this.title = shareUrl.title;
            this.description = shareUrl.description;
        }
        if (this.routesService.selectedRoute != null) {
            let route = routesService.selectedRoute.getData();
            if (shareUrl == null || (!this.title && !this.description)) {
                this.title = route.name;
                this.description = route.description;
            }
            if (route.segments.length > 0) {
                switch (route.segments[route.segments.length - 1].routingType) {
                    case "Hike":
                        this.offroadRequest.activityType = "Walking";
                        break;
                    case "Bike":
                        this.offroadRequest.activityType = "Cycling";
                        break;
                }
            }
        }
    }

    public async ngAfterViewInit(): Promise<any> {
        let dataToPreview = this.getDataFiltered();
        let imageUrl = await this.osmUserService.getImagePreview(dataToPreview);
        this.imageUrl = this.sanitizer.bypassSecurityTrustUrl(imageUrl) as string;
    }

    public getDisplayName() {
        return this.osmUserService.getDisplayNameFromTitleAndDescription(this.title, this.description);
    }

    public uploadShareUrl = async () => {
        this.isLoading = true;
        let shareUrlToSend = this.createShareUrlObject();

        try {
            let shareUrl = this.updateCurrentShare
                ? await this.osmUserService.updateShareUrl(shareUrlToSend)
                : await this.osmUserService.createShareUrl(shareUrlToSend);

            this.lastShareUrl = shareUrl;
            this.dataContainerService.setShareUrl(shareUrl);
            this.imageUrl = this.osmUserService.getImageFromShareId(shareUrl);
            let links = this.osmUserService.getShareSocialLinks(shareUrl);
            this.shareAddress = links.ihm;
            this.whatsappShareAddress = links.whatsapp;
            this.facebookShareAddress = links.facebook;
            this.nakebCreateHikeAddress = links.nakeb;
        } catch (ex) {
            this.toastService.error(this.resources.unableToGenerateUrl);
        } finally {
            this.isLoading = false;
        }
    }

    private getDataFiltered(): DataContainer {
        let filteredData = this.dataContainerService.getData();
        for (let routeIndex = filteredData.routes.length - 1; routeIndex >= 0; routeIndex--) {
            let route = filteredData.routes[routeIndex];
            if (route.segments.length === 0 && route.markers.length === 0) {
                filteredData.routes.splice(routeIndex, 1);
            }
        }
        return filteredData;
    }

    private createShareUrlObject = (): ShareUrl => {
        if (this.routesService.routes.length === 1 && !this.routesService.routes[0].route.properties.description) {
            this.routesService.routes[0].route.properties.description = this.description;
        }

        let id = this.dataContainerService.getShareUrl() ? this.dataContainerService.getShareUrl().id : "";
        let shareUrl = {
            id: id,
            title: this.title,
            description: this.description,
            dataContainer: this.getDataFiltered(),
            osmUserId: this.osmUserService.isLoggedIn() ? this.osmUserService.userId : ""
        } as ShareUrl;
        return shareUrl;
    }

    public sendToOffroad = () => {
        this.offroadRequest.title = this.title;
        this.offroadRequest.description = this.description;
        this.storedUserEmail = this.offroadRequest.userMail;
        if (this.routesService.selectedRoute == null) {
            this.toastService.warning(this.resources.pleaseSelectARoute);
            return;
        }
        let route = this.routesService.selectedRoute.getData();
        if (route.segments.length === 0) {
            this.toastService.warning(this.resources.pleaseAddPointsToRoute);
            return;
        }
        this.offroadRequest.sharingCode = this.offroadPublicTrack ? 1 : 3;
        this.offroadRequest.path = [];
        this.offroadRequest.mapItems = [];
        this.offroadRequest.externalUrl = this.shareAddress;
        this.offroadRequest.backgroundServeUrl = this.osmUserService.getImageFromShareId(this.lastShareUrl);

        for (let segment of route.segments) {
            for (let latlng of segment.latlngs) {
                this.offroadRequest.path.push({ altitude: latlng.alt, latitude: latlng.lat, longitude: latlng.lng });
            }
        }
        let index = 0;
        for (let marker of route.markers) {
            this.offroadRequest.mapItems.push({
                title: `Point ${index++}`,
                mapItemType: "POI",
                visibilityLevel: "Track",
                description: marker.title,
                point: { latitude: marker.latlng.lat, longitude: marker.latlng.lng, altitude: marker.latlng.alt || 0 }
            });
        }
        let address = "https://brilliant-will-93906.appspot.com/_ah/api/myAdventureApi/v1/tracks/external";
        this.httpClient.post(address, this.offroadRequest).toPromise().then(() => {
            this.toastService.success(this.resources.routeSentSuccessfully);
        }, (err) => {
            this.toastService.error(this.resources.unableToSendRoute);
            console.error(err);
        });
    }
}
