import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { PoiService, IPoiSocialLinks } from "../../../services/poi.service";
import { AuthorizationService } from "../../../services/authorization.service";
import { ToastService } from "../../../services/toast.service";
import { HashService, RouteStrings, IPoiRouterData } from "../../../services/hash.service";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { AddRouteAction, AddPrivatePoiAction } from "../../../reducres/routes.reducer";
import { RoutesFactory } from "../../../services/layers/routelayers/routes.factory";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SetSelectedPoiAction, SetUploadMarkerDataAction, SetSidebarAction } from "../../../reducres/poi.reducer";
import { SpatialService } from "../../../services/spatial.service";
import { RunningContextService } from "../../../services/running-context.service";
import { SidebarService } from "../../../services/sidebar.service";
import { NavigateHereService } from "../../../services/navigate-here.service";
import { sidebarAnimate } from "../sidebar.component";
import {
    RouteData,
    LinkData,
    LatLngAlt,
    ApplicationState,
    PointOfInterestExtended,
    Contribution,
    NorthEast
} from "../../../models/models";

@Component({
    selector: "public-poi-sidebar",
    templateUrl: "./public-poi-sidebar.component.html",
    encapsulation: ViewEncapsulation.None,
    animations: [
        sidebarAnimate
    ]
})
export class PublicPoiSidebarComponent extends BaseMapComponent implements OnDestroy {
    public info: PointOfInterestExtended;
    public isLoading: boolean;
    public showLocationUpdate: boolean;
    public updateLocation: boolean;
    public sourceImageUrls: string[];
    public latlng: LatLngAlt;
    public itmCoordinates: NorthEast;
    public shareLinks: IPoiSocialLinks;
    public contribution: Contribution;
    
    @select((state: ApplicationState) => state.poiState.isSidebarOpen)
    public isOpen: Observable<boolean>;

    private editMode: boolean;
    private poiExtended: PointOfInterestExtended;
    private originalLocation: LatLngAlt;
    private subscriptions: Subscription[];

    constructor(resources: ResourcesService,
                private readonly router: Router,
                private readonly route: ActivatedRoute,
                private readonly poiService: PoiService,
                private readonly authorizationService: AuthorizationService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routesFactory: RoutesFactory,
                private readonly toastService: ToastService,
                private readonly hashService: HashService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly sidebarService: SidebarService,
                private readonly runningContextSerivce: RunningContextService,
                private readonly navigateHereService: NavigateHereService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.sidebarService.hideWithoutChangingAddressbar();
        this.isLoading = true;
        this.showLocationUpdate = false;
        this.updateLocation = false;
        this.originalLocation = null;
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
            let editMode = params[RouteStrings.EDIT] === "true";
            let snapshot = this.route.snapshot;
            let poiSourceAndId = this.getDataFromRoute(snapshot.paramMap, snapshot.queryParamMap);
            if (editMode && poiSourceAndId.source !== "new") {
                await this.getExtendedData(poiSourceAndId);
            }
            // change this only after we get the full data
            // so that the edit dialog will have all the necessary data to decide
            this.editMode = editMode;
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
                    references: [],
                    isEditable: true,
                    dataContainer: { routes: [] },
                } as PointOfInterestExtended;
                this.mergeDataIfNeededData(newPoi);
            } else {
                let poiExtended = await this.poiService.getPoint(data.id, data.source, data.language);
                this.originalLocation = poiExtended.location;
                this.mergeDataIfNeededData(poiExtended);
                let features = this.poiExtended.featureCollection ? this.poiExtended.featureCollection.features : [];
                if (features.length > 0) {
                    let feature = features.find(f => f.geometry.type !== "Point") || features[0];
                    let bounds = SpatialService.getBoundsForFeature(feature);
                    this.fitBoundsService.fitBounds(bounds);
                }
                this.ngRedux.dispatch(new SetSelectedPoiAction({
                    poi: this.poiExtended
                }));
                if (this.runningContextSerivce.isMobile && data.source === "Coordinates") {
                    this.close();
                }
            }
        } catch (ex) {
            this.toastService.warning(this.resources.unableToFindPoi);
            this.close();
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
            if (poiExtended.id && !poiExtended.isArea && !poiExtended.isRoute) {
                this.showLocationUpdate = true;
            }
        }
        this.initFromPointOfInterestExtended(poiExtended);
    }

    private initFromPointOfInterestExtended = (poiExtended: PointOfInterestExtended) => {
        this.poiExtended = poiExtended;
        this.latlng = { lat: poiExtended.location.lat, lng: poiExtended.location.lng, alt: poiExtended.location.alt};
        this.sourceImageUrls = poiExtended.references.map(r => r.sourceImageUrl);
        this.shareLinks = this.poiService.getPoiSocialLinks(poiExtended);
        this.contribution = this.poiExtended.contribution || {} as Contribution;
        this.itmCoordinates = this.poiExtended.itmCoordinates;
        // clone:
        this.info = JSON.parse(JSON.stringify(this.poiExtended));
        this.info.icon = this.info.icon;
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
        let description = this.poiExtended.description || this.poiExtended.externalDescription;
        if (description) {
            return description;
        }
        if (!this.poiExtended.isEditable) {
            return description;
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
        if (!this.runningContextSerivce.isOnline) {
            this.toastService.warning(this.resources.cantEditWhileOffline);
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
        if (!this.runningContextSerivce.isOnline) {
            this.toastService.warning(this.resources.cantEditWhileOffline);
            return;
        }
        this.isLoading = true;
        try {
            if (!this.updateLocation) {
                this.info.location = this.originalLocation;
            }
            this.originalLocation = null;
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

    public convertToRoute() {
        let routesCopy = JSON.parse(JSON.stringify(this.poiExtended.dataContainer.routes)) as RouteData[];
        for (let routeData of routesCopy) {
            let name = this.selectedRouteService.createRouteName(routeData.name);
            let newRoute = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
            newRoute.description = this.info.description;
            newRoute.segments = routeData.segments;
            newRoute.markers = routeData.markers;
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: newRoute
            }));
            this.selectedRouteService.setSelectedRoute(newRoute.id);
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
        let urls = this.getUrls();
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: selectedRoute.id,
            markerData: {
                latlng: this.latlng,
                title: this.info.title,
                description: this.info.description,
                type: icon.replace("icon-", ""),
                id,
                urls
            }
        }));
        this.clear();
    }

    public navigateHere() {
        this.navigateHereService.addNavigationSegment(this.poiExtended.location, this.poiExtended.title);
    }

    public clear() {
        if (this.poiExtended) {
            this.ngRedux.dispatch(new SetSelectedPoiAction({
                poi: null
            }));
        }
        this.close();
    }

    private getUrls(): LinkData[] {
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
                urls.push({
                    mimeType: `image/${imageUrl.split(".").pop().replace("jpg", "jpeg")}`,
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
