import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { NgRedux, select } from "@angular-redux/store";
import { format } from "openlayers";
import { sum } from "lodash";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { PoiService, IPoiSocialLinks } from "../../../services/poi.service";
import { AuthorizationService } from "../../../services/authorization.service";
import { ToastService } from "../../../services/toast.service";
import { HashService, RouteStrings, IPoiRouterData } from "../../../services/hash.service";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { AddRouteAction, AddPrivatePoiAction } from "../../../reducres/routes.reducer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SetSelectedPoiAction, SetUploadMarkerDataAction, SetSidebarAction } from "../../../reducres/poi.reducer";
import { SetSelectedRouteAction } from "../../../reducres/route-editing-state.reducer";
import { SpatialService } from "../../../services/spatial.service";
import { SidebarService } from "../../../services/sidebar.service";
import { sibebarAnimate } from "../sidebar.component";
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
    encapsulation: ViewEncapsulation.None,
    animations: [
        sibebarAnimate
    ]
})
export class PublicPoiSidebarComponent extends BaseMapComponent implements OnDestroy {
    public info: PointOfInterestExtended;
    public isLoading: boolean;
    public sourceImageUrls: string[];
    public rating: number;
    public latlng: LatLngAlt;
    public shareLinks: IPoiSocialLinks;
    public contribution: Contribution;

    @select((state: ApplicationState) => state.poiState.isSidebarOpen)
    public isOpen: Observable<boolean>;

    private editMode: boolean;
    private poiExtended: PointOfInterestExtended;
    private subscriptions: Subscription[];

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly route: ActivatedRoute,
        private readonly poiService: PoiService,
        private readonly authorizationService: AuthorizationService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly toastService: ToastService,
        private readonly hashService: HashService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly sidebarService: SidebarService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.sidebarService.hideWithoutChangingAddressbar();
        this.isLoading = true;
        this.shareLinks = {} as IPoiSocialLinks;
        this.contribution = {} as Contribution;
        this.info = { imagesUrls: [], references: [] } as PointOfInterestExtended;
        this.subscriptions = [];
        this.subscriptions.push(this.route.paramMap.subscribe(async (_) => {
            if (!this.router.url.startsWith(RouteStrings.ROUTE_POI)) {
                return;
            }
            let snapshot = this.route.snapshot;
            let poiSourceAndId = this.getDataFromRoute(snapshot.paramMap, snapshot.queryParamMap);
            if (snapshot.queryParamMap.get(RouteStrings.EDIT) !== "true" || poiSourceAndId.source === "new") {
                await this.getExtendedData(poiSourceAndId);
            }
        }));
        this.subscriptions.push(this.route.queryParams.subscribe(async (params) => {
            if (!this.router.url.startsWith(RouteStrings.ROUTE_POI)) {
                return;
            }
            this.editMode = params[RouteStrings.EDIT] === "true";
            let snapshot = this.route.snapshot;
            let poiSourceAndId = this.getDataFromRoute(snapshot.paramMap, snapshot.queryParamMap);
            if (this.editMode && poiSourceAndId.source !== "new") {
                await this.getExtendedData(poiSourceAndId);
            }
        }));
    }

    private getDataFromRoute(params, queryParams) {
        return {
            id: params.get(RouteStrings.ID),
            source: params.get(RouteStrings.SOURCE),
            language: queryParams.get(RouteStrings.LANGUAGE)
        } as IPoiRouterData;
    }

    public ngOnDestroy() {
        for (let subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    private async getExtendedData(data: IPoiRouterData) {
        try {
            this.ngRedux.dispatch(new SetSidebarAction({
                isOpen: true
            }));
            if (data.source === "new") {
                let newPoi = {
                    imagesUrls: [],
                    source: "OSM",
                    id: "",
                    rating: { raters: [] },
                    references: [],
                    isEditable: true,
                    dataContainer: { routes: [] },
                } as PointOfInterestExtended;
                this.mergeDataIfNeededData(newPoi);
            } else {
                let poiExtended = await this.poiService.getPoint(data.id, data.source, data.language);
                this.mergeDataIfNeededData(poiExtended);
                let features = new format.GeoJSON().readFeatures(this.poiExtended.featureCollection,
                    { dataProjection: "EPSG:4326", featureProjection: "EPSG:4326" });
                if (features.length > 0) {
                    let geometry = features.map(f => f.getGeometry()).find(g => g.getType() !== "Point") || features[0].getGeometry();
                    let bounds = SpatialService.extentToBounds(geometry.getExtent());
                    this.fitBoundsService.fitBounds(bounds);
                }
                this.ngRedux.dispatch(new SetSelectedPoiAction({
                    poi: this.poiExtended
                }));
            }
        } finally {
            this.isLoading = false;
        }
    }

    private async mergeDataIfNeededData(poiExtended: PointOfInterestExtended) {
        let uploadMarkerData = this.ngRedux.getState().poiState.uploadMarkerData;
        if (uploadMarkerData != null) {
            this.poiService.mergeWithPoi(poiExtended, uploadMarkerData);
            this.ngRedux.dispatch(new SetUploadMarkerDataAction({
                markerData: null
            }));
        }
        this.initFromPointOfInterestExtended(poiExtended);
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

    public getDescription(): string {
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
        let routesCopy = JSON.parse(JSON.stringify(this.poiExtended.dataContainer.routes)) as RouteData[];
        for (let routeData of routesCopy) {
            let name = this.selectedRouteService.createRouteName(routeData.name);
            let newRoute = this.routeLayerFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
            newRoute.description = this.info.description;
            newRoute.segments = routeData.segments;
            newRoute.markers = routeData.markers;
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: newRoute
            }));
            this.ngRedux.dispatch(new SetSelectedRouteAction({
                routeId: newRoute.id
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
        this.ngRedux.dispatch(new SetSidebarAction({
            isOpen: false
        }));
        // reset address bar only after animation ends.
        setTimeout(() => this.hashService.resetAddressbar(), 500);
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