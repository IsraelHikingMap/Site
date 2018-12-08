import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { NgRedux } from "@angular-redux/store";
import { sum } from "lodash";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { SidebarService } from "../../../services/sidebar.service";
import { PoiService, IPoiSocialLinks } from "../../../services/poi.service";
import { AuthorizationService } from "../../../services/authorization.service";
import { ToastService } from "../../../services/toast.service";
import { HashService, IPoiRouterData, RouteStrings } from "../../../services/hash.service";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { AddRouteAction, AddPrivatePoiAction } from "../../../reducres/routes.reducer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SetSelectedPoiAction } from "../../../reducres/poi.reducer";
import {
    RouteData,
    LinkData,
    LatLngAlt,
    ApplicationState,
    PointOfInterestExtended,
    Contribution,
    Rating,
    Rater
} from "../../../models/models";

@Component({
    selector: "public-poi-sidebar",
    templateUrl: "./public-poi-sidebar.component.html",
    styleUrls: ["./public-poi-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class PublicPoiSidebarComponent extends BaseMapComponent implements OnDestroy {
    public info: PointOfInterestExtended;
    public isLoading: boolean;
    public sourceImageUrls: string[];
    public rating: number;
    public latlng: LatLngAlt;
    public shareLinks: IPoiSocialLinks;
    public contribution: Contribution;

    private editMode: boolean;
    private poiExtended: PointOfInterestExtended;
    private subscription: Subscription;

    constructor(resources: ResourcesService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly sidebarService: SidebarService,
        private readonly poiService: PoiService,
        private readonly authorizationService: AuthorizationService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly toastService: ToastService,
        private readonly hashService: HashService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        let poiRouterData = this.hashService.getPoiRouterData();
        this.isLoading = true;
        this.shareLinks = {} as IPoiSocialLinks;
        this.contribution = {} as Contribution;
        this.info = { imagesUrls: [], references: [] } as PointOfInterestExtended;
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
            let latLng = { lat: poiExtended.location.lat, lng: poiExtended.location.lng };
            let bounds = { northEast: latLng, southWest: latLng };
            this.fitBoundsService.fitBounds(bounds);
            this.ngRedux.dispatch(new SetSelectedPoiAction({
                poi: poiExtended
            }));
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

    private initFromPointOfInterestExtended = (poiExtended: PointOfInterestExtended) => {
        this.poiExtended = poiExtended;
        this.latlng = { lat: poiExtended.location.lat, lng: poiExtended.location.lng, alt: poiExtended.location.alt};
        this.sourceImageUrls = poiExtended.references.map(r => r.sourceImageUrl);
        this.rating = this.getRatingNumber(this.poiExtended.rating);
        this.shareLinks = this.poiService.getPoiSocialLinks(poiExtended);
        this.contribution = this.poiExtended.contribution || {} as Contribution;
        // clone:
        this.info = JSON.parse(JSON.stringify(this.poiExtended));
    }

    private getRatingNumber(rating: Rating): number {
        return sum(rating.raters.map(r => r.value));
    }

    public isHideEditMode(): boolean {
        return !this.authorizationService.isLoggedIn() ||
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
        if (this.authorizationService.isLoggedIn() === false) {
            return this.resources.noDescriptionLoginRequired;
        }
        return this.resources.emptyPoiDescription;
    }

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        if (this.authorizationService.isLoggedIn() === false) {
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
        if (this.authorizationService.isLoggedIn() === false) {
            return false;
        }
        if (this.poiExtended == null) {
            return false;
        }
        let vote = this.poiExtended.rating.raters.find(r => r.id === this.authorizationService.getUserInfo().id);
        if (vote == null) {
            return true;
        }
        return type === "up" && vote.value < 0 || type === "down" && vote.value > 0;
    }

    private vote(value: number) {
        if (this.canVote(value > 0 ? "up" : "down") === false) {
            if (this.authorizationService.isLoggedIn() === false) {
                this.toastService.info(this.resources.loginRequired);
            }
            return;
        }
        let userId = this.authorizationService.getUserInfo().id;
        this.poiExtended.rating.raters = this.poiExtended.rating.raters.filter(r => r.id !== userId);
        this.poiExtended.rating.raters.push({ id: userId, value: value } as Rater);
        this.poiService.uploadRating(this.poiExtended.rating).then((rating) => {
            this.poiExtended.rating = rating;
            this.rating = this.getRatingNumber(rating);
        });
    }

    public convertToRoute() {
        // HM TODO: add can convert and allow conversion of routes only... remove isArea?
        let routesCopy = JSON.parse(JSON.stringify(this.poiExtended.dataContainer.routes)) as RouteData[];
        routesCopy[0].description = this.info.description;
        for (let routeData of routesCopy) {
            let name = this.selectedRouteService.createRouteName(routeData.name);
            let newRoute = this.routeLayerFactory.createRouteData(name);
            newRoute.segments = routeData.segments;
            newRoute.markers = routeData.markers;
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: newRoute
            }));
        }
        this.clear();
    }

    public async addPointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        let icon = "icon-star";
        let id = "";
        if (this.poiExtended) {
            icon = this.poiExtended.icon;
            id = this.poiExtended.id;
        }
        let urls = await this.getUrls();
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: selectedRoute.id,
            markerData: {
                latlng: this.latlng,
                title: this.info.title,
                description: this.info.description,
                type: icon.replace("icon-", ""),
                id: id,
                urls: urls
            }
        }));
        this.clear();
    }

    public clear() {
        if (this.poiExtended) {
            this.ngRedux.dispatch(new SetSelectedPoiAction({
                poi: null
            }));
        }
        this.close();
    }

    private async getUrls(): Promise<LinkData[]> {
        let urls = [] as LinkData[];
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
        return this.authorizationService.getElementOsmAddress(this.poiExtended.id);
    }
}