import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { AuthorizationService } from "../../services/authorization.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { OsmUserService } from "../../services/osm-user.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { GeoJsonParser } from "../../services/geojson.parser";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";


export interface IPointOfInterest {
    id: string;
    category: string;
    title: string;
    location: L.LatLng;
    source: string;
    icon: string;
    iconColor: string;
}

export interface IPointOfInterestExtended extends IPointOfInterest {
    imageUrl: string;
    description: string;
    rating: number;
    url: string;
    isEditable: boolean;
    featureCollection: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
}

@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poi-marker-popup.component.html"
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    private static readonly THREE_HOURES = 3 * 60 * 60 * 1000;

    public description: string;
    public thumbnail: string;
    public address: string;
    public source: string;
    public rating: number;
    private editMode: boolean;
    private routeData: Common.RouteData;
    private extendedDataArrivedTimeStamp: Date;
    private poiExtended: IPointOfInterestExtended;

    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private geoJsonParser: GeoJsonParser,
        private toastService: ToastService,
        private authorizationService: AuthorizationService,
        private routesService: RoutesService,
        private osmUserService: OsmUserService) {
        super(resources, http, applicationRef, elevationProvider);
        this.editMode = false;
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
                this.toastService.warning(this.resources.closeWhileInEditMode);
            }
            this.editMode = false;
        });
    }

    public selectRoute = (routeData: Common.RouteData): void => {
        console.log(routeData);
        throw new Error("This function must be assigned by containing layer!");
    };
    public clearSelectedRoute = (): void => { throw new Error("This function must be assigned by the containing layer!") };

    public getDescrition() {
        let description = this.description;
        if (description) {
            return description;
        }
        if (!this.poiExtended || !this.poiExtended.isEditable) {
            return "";
        }
        return this.resources.emptyPoiDescription;
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
        this.editMode = true;
    }

    public canBeConvertedToRoute() {
        return this.routeData && this.routeData.segments.length > 0;
    }

    public save() {
        this.editMode = false;
        this.poiExtended.description = this.description;
        let address = Urls.poi + this.source + "/" + this.marker.identifier + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
        this.http.put(address, this.poiExtended, this.authorizationService.getHeader()).toPromise().then(() => {
            this.toastService.info(this.resources.dataUpdatedSuccefully);
        });
    }

    public voteUp() {
        this.rating++;
        // HM TODO: send rating to server
    }

    public voteDown() {
        this.rating--;
        // HM TODO: send rating to server.
        // HM TODO: allow only once.
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
        this.http.get(Urls.poi + this.source + "/" + this.marker.identifier,
            {
                params: { language: this.resources.getCurrentLanguageCodeSimplified() }
            }).toPromise().then((response) => {
            this.extendedDataArrivedTimeStamp = new Date();
            let poiExtended = response.json() as IPointOfInterestExtended;
            this.poiExtended = poiExtended;
            this.description = poiExtended.description;
            this.address = poiExtended.url;
            this.thumbnail = poiExtended.imageUrl;
            this.rating = poiExtended.rating || 0;
            var container = this.geoJsonParser.toDataContainer(poiExtended.featureCollection,
                this.resources.getCurrentLanguageCodeSimplified());
            this.routeData = container.routes[0];
            this.selectRoute(this.routeData);
        });
    }
}