import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { LocalStorage } from "angular2-localstorage";
import { ResourcesService } from "../../services/ResourcesService";
import { MapService } from "../../services/MapService";
import { OsmUserService } from "../../services/OsmUserService";
import { ToastService } from "../../services/ToastService";
import { LayersService } from "../../services/layers/LayersService";
import { BaseMapComponent } from "../BaseMapComponent";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";

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
    sharingCode: number; //should be 3 fixed
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
    templateUrl: "application/components/dialogs/shareDialog.html"
})
export class ShareDialogComponent extends BaseMapComponent {
    public title: string;
    public imageUrl: string;
    public shareAddress: string;
    public whatappShareAddress: string;
    public facebookShareAddress: string;
    public width: number;
    public height: number;
    public size: string;
    public embedText: string;
    public isLoading: boolean;
    public siteUrlId: string;
    public offroadRequest: IOffroadPostRequest;

    @LocalStorage()
    public storedUserEmail: string = "";

    private static USER_EMAIL_KEY = "offroadUserEmail";

    constructor(resources: ResourcesService,
        private http: Http,
        private mapService: MapService,
        private layersService: LayersService,
        private osmUserService: OsmUserService,
        private toastService: ToastService,
    ) {
        super(resources);

        this.osmUserService = osmUserService;
        this.title = "";
        this.width = 400;
        this.height = 300;
        this.size = this.resources.small;
        this.isLoading = false;
        this.embedText = this.getEmbedText();
        this.offroadRequest = {} as IOffroadPostRequest;
        this.offroadRequest.userMail = this.storedUserEmail;
        this.offroadRequest.activityType = "OffRoading";
        this.offroadRequest.difficultyLevel = "3";
        if (this.layersService.getSelectedRoute() != null) {
            let route = layersService.getSelectedRoute().getData();
            this.title = route.name;
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
        this.clearShareAddress();
    }

    public clearShareAddress = () => {
        this.shareAddress = "";
        this.whatappShareAddress = "";
        this.facebookShareAddress = "";
        this.siteUrlId = "";
    }

    public updateEmbedText = (width: number, height: number) => {
        this.width = width;
        this.height = height;
        this.embedText = this.getEmbedText();
    }

    public generateUrl = (title: string, description: string) => {
        this.isLoading = true;
        this.offroadRequest.title = title;
        this.offroadRequest.description = description;
        var dataToSave = this.layersService.getData();
        for (let routeIndex = dataToSave.routes.length - 1; routeIndex >= 0; routeIndex--) {
            let route = dataToSave.routes[routeIndex];
            if (route.segments.length === 0 && route.markers.length === 0) {
                dataToSave.routes.splice(routeIndex, 1);
            }
        }
        var siteUrl = {
            title: title,
            description: description,
            jsonData: JSON.stringify(dataToSave),
            osmUserId: this.osmUserService.isLoggedIn() ? this.osmUserService.userId : ""
        } as Common.SiteUrl;
        this.osmUserService.createSiteUrl(siteUrl).then((siteUrlResponse) => {
            let data = siteUrlResponse.json() as Common.SiteUrl;
            this.siteUrlId = data.id;
            this.shareAddress = this.osmUserService.getUrlFromSiteUrlId(data);
            this.imageUrl = this.osmUserService.getImageFromSiteUrlId(data);
            let escaped = encodeURIComponent(this.shareAddress); // HM TODO: Need TO check window.??
            this.whatappShareAddress = `whatsapp://send?text=${escaped}`;
            this.facebookShareAddress = `http://www.facebook.com/sharer/sharer.php?u=${escaped}`;
            this.embedText = this.getEmbedText();
            this.isLoading = false;
        }, () => {
            this.toastService.error(this.resources.unableToGenerateUrl);
            this.isLoading = false;
        });
    }

    public setSize = (size: string) => {
        switch (size) {
            case this.resources.small:
                this.width = 400;
                this.height = 300;
                break;
            case this.resources.medium:
                this.width = 600;
                this.height = 450;
                break;
            case this.resources.large:
                this.width = 800;
                this.height = 600;
                break;
        }
        this.embedText = this.getEmbedText();
    }

    public sendToOffroad = () => {
        this.storedUserEmail = this.offroadRequest.userMail;
        if (this.layersService.getSelectedRoute() == null) {
            this.toastService.warning(this.resources.pleaseSelectARoute);
            return;
        }
        let route = this.layersService.getSelectedRoute().getData();
        if (route.segments.length === 0) {
            this.toastService.warning(this.resources.pleaseAddPointsToRoute);
            return;
        }
        this.offroadRequest.sharingCode = 3; //fixed
        this.offroadRequest.path = [];
        this.offroadRequest.mapItems = [];
        this.offroadRequest.externalUrl = this.shareAddress;
        this.offroadRequest.backgroundServeUrl = Urls.images + this.siteUrlId;

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
        this.http.post(address, this.offroadRequest).toPromise().then(() => {
            this.toastService.success(this.resources.routeSentSuccessfully);
        }, (err) => {
            this.toastService.error(this.resources.unableToSendRoute);
            console.error(err);
        });
    }

    private getEmbedText = () => {
        var shareAddress = `//${window.location.host}${this.osmUserService.getSiteUrlPostfix(this.siteUrlId)}`;
        return `<iframe src='${shareAddress}' width='${this.width}' height='${this.height}' frameborder='0' scrolling='no'></iframe>`;
    }
}
