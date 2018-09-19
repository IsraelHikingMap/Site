import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import * as _ from "lodash";
import * as L from "leaflet";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { SidebarService } from "../../../services/sidebar.service";
import {
    PoiService,
    IPointOfInterestExtended,
    IRater,
    IRating,
    IPoiSocialLinks,
    IContribution
} from "../../../services/poi.service";
import { MapService } from "../../../services/map.service";
import { OsmUserService } from "../../../services/osm-user.service";
import { RoutesService } from "../../../services/layers/routelayers/routes.service";
import { ToastService } from "../../../services/toast.service";
import { IMarkerWithData } from "../../../services/layers/routelayers/iroute.layer";
import { CategoriesLayerFactory } from "../../../services/layers/categories-layers.factory";
import { HashService, IPoiRouterData, RouteStrings } from "../../../services/hash.service";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "public-poi-sidebar",
    templateUrl: "./public-poi-sidebar.component.html",
    styleUrls: ["./public-poi-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class PublicPoiSidebarComponent extends BaseMapComponent implements OnDestroy {
    public info: IPointOfInterestExtended;
    public isLoading: boolean;
    public sourceImageUrls: string[];
    public rating: number;
    public latLng: L.LatLng;
    public shareLinks: IPoiSocialLinks;
    public contribution: IContribution;

    private editMode: boolean;
    private poiExtended: IPointOfInterestExtended;
    private subscription: Subscription;

    constructor(resources: ResourcesService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly mapService: MapService,
        private readonly sidebarService: SidebarService,
        private readonly poiService: PoiService,
        private readonly osmUserService: OsmUserService,
        private readonly routesService: RoutesService,
        private readonly toastService: ToastService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly hashService: HashService) {
        super(resources);
        let poiRouterData = this.hashService.getPoiRouterData();
        this.isLoading = true;
        this.shareLinks = {} as IPoiSocialLinks;
        this.contribution = {} as IContribution;
        this.info = { imagesUrls: [], references: [] } as IPointOfInterestExtended;
        this.getExtendedData(poiRouterData);
    }

    public ngOnDestroy() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
    }

    private async getExtendedData(data: IPoiRouterData) {
        try {
            let poiExtended = await this.poiService.getPoint(data.id, data.source, data.language);
            this.initFromPointOfInterestExtended(poiExtended);
            let latLng = L.latLng(poiExtended.location.lat, poiExtended.location.lng);
            let bounds = L.latLngBounds([latLng, latLng]);
            this.categoriesLayerFactory.getByPoiType(poiExtended.isRoute).moveToSearchResults(poiExtended, bounds);
            let categoriesLayer = this.categoriesLayerFactory.getByPoiType(poiExtended.isRoute);
            categoriesLayer.selectRoute(this.poiExtended.dataContainer.routes, this.poiExtended.isArea);
            // Change edit mode only after this.info is initialized.
            this.subscription = this.route.queryParams.subscribe(async (params) => {
                this.editMode = params[RouteStrings.EDIT] && params[RouteStrings.EDIT] === "true";
                if (this.editMode) {
                    // HM TODO: need to think of a better way to refresh data.
                    poiExtended = await this.poiService.getPoint(data.id, data.source, data.language);
                    this.initFromPointOfInterestExtended(poiExtended);
                }
            });
        } finally {
            this.isLoading = false;
        }
    }

    private initFromPointOfInterestExtended = (poiExtended: IPointOfInterestExtended) => {
        this.poiExtended = poiExtended;
        this.latLng = L.latLng(poiExtended.location.lat, poiExtended.location.lng, poiExtended.location.alt);
        this.sourceImageUrls = poiExtended.references.map(r => r.sourceImageUrl);
        this.rating = this.getRatingNumber(this.poiExtended.rating);
        this.mapService.routesJsonToRoutesObject(this.poiExtended.dataContainer.routes);
        this.shareLinks = this.poiService.getPoiSocialLinks(poiExtended);
        this.contribution = this.poiExtended.contribution || {} as IContribution;
        // clone:
        this.info = JSON.parse(JSON.stringify(this.poiExtended));
    }

    private getRatingNumber(rating: IRating): number {
        return _.sum(rating.raters.map(r => r.value));
    }

    public isHideEditMode(): boolean {
        return !this.osmUserService.isLoggedIn() ||
            !this.poiExtended ||
            !this.poiExtended.isEditable ||
            this.editMode;
    }

    public getDescrition(): string {
        if (!this.poiExtended) {
            return "";
        }
        if (!this.poiExtended.isEditable) {
            return this.poiExtended.description;
        }
        if (this.poiExtended.description) {
            return this.poiExtended.description;
        }
        if (this.osmUserService.isLoggedIn() === false) {
            return this.resources.noDescriptionLoginRequired;
        }
        return this.resources.emptyPoiDescription;
    }

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        if (this.osmUserService.isLoggedIn() === false) {
            this.toastService.info(this.resources.loginRequired);
            return;
        }
        this.router.navigate([RouteStrings.ROUTE_POI, this.poiExtended.source, this.poiExtended.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
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

    public async save() {
        this.isLoading = true;
        try {
            let poiExtended = await this.poiService.uploadPoint(this.info);
            this.initFromPointOfInterestExtended(poiExtended);
            this.toastService.info(this.resources.dataUpdatedSuccessfully);
            this.poiService.setAddOrUpdateMarkerData(null);
            this.router.navigate([RouteStrings.ROUTE_POI, this.poiExtended.source, this.poiExtended.id],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
        } catch (ex) {
            this.toastService.confirm({ message: this.resources.unableToSaveData, type: "Ok" });
        } finally {
            this.isLoading = false;
        }
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
        routesCopy[0].description = this.info.description;
        this.routesService.setData(routesCopy);
        this.clear();
    }

    public async addPointToRoute() {
        let selectedRoute = this.routesService.getOrCreateSelectedRoute();
        let stateName = selectedRoute.getStateName();
        this.routesService.selectedRoute.setHiddenState();
        let icon = "icon-star";
        let id = "";
        if (this.poiExtended) {
            icon = this.poiExtended.icon;
            id = this.poiExtended.id;
        }
        let urls = await this.getUrls();
        this.routesService.selectedRoute.route.markers.push({
            latlng: this.latLng,
            title: this.info.title,
            description: this.info.description,
            type: icon.replace("icon-", ""),
            id: id,
            urls: urls,
            marker: null
        } as IMarkerWithData);
        selectedRoute.setState(stateName);
        selectedRoute.raiseDataChanged();
        this.clear();
    }

    public clear() {
        if (this.poiExtended) {
            this.categoriesLayerFactory.getByPoiType(this.poiExtended.isRoute).clearSelected(this.poiExtended.id);
        }
        this.close();
    }

    private async getUrls(): Promise<Common.LinkData[]> {
        let urls = [] as Common.LinkData[];
        for (let reference of this.info.references) {
            urls.push({
                mimeType: "text/html",
                text: this.info.title,
                url: reference.url
            });
        }
        if (this.poiExtended && this.poiExtended.imagesUrls.length > 0) {
            for (let imageUrl of this.poiExtended.imagesUrls) {
                let res = await fetch(imageUrl);
                let blob = await res.blob();
                urls.push({
                    mimeType: blob.type,
                    text: "",
                    url: imageUrl
                });
            }
        }
        return urls;
    }

    public close() {
        this.sidebarService.hide();
        this.hashService.setApplicationState("poi", null);
        this.poiService.setAddOrUpdateMarkerData(null);
        this.hashService.resetAddressbar();
    }

    public getElementOsmAddress(): string {
        if (!this.poiExtended) {
            return null;
        }
        if (this.poiExtended.source.toLocaleLowerCase() !== "osm") {
            return null;
        }
        return this.osmUserService.getElementOsmAddress(this.poiExtended.id);
    }
}