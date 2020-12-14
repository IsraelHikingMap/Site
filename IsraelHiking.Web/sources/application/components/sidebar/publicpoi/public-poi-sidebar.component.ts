import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { Subscription } from "rxjs";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { cloneDeep } from "lodash";

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
import { GeoJsonParser } from '../../../services/geojson.parser';
import { sidebarAnimate } from "../sidebar.component";
import {
    LinkData,
    LatLngAlt,
    ApplicationState,
    EditablePublicPointData,
    Contribution,
    NorthEast
} from "../../../models/models";

@Component({
    selector: "public-poi-sidebar",
    templateUrl: "./public-poi-sidebar.component.html",
    styleUrls: ["./public-poi-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None,
    animations: [
        sidebarAnimate
    ]
})
export class PublicPoiSidebarComponent extends BaseMapComponent implements OnDestroy {
    public info: EditablePublicPointData;
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
    private poiExtended: GeoJSON.Feature;
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
                private readonly geoJsonParser: GeoJsonParser,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.sidebarService.hideWithoutChangingAddressbar();
        this.isLoading = true;
        this.showLocationUpdate = false;
        this.updateLocation = false;
        this.originalLocation = null;
        this.shareLinks = {} as IPoiSocialLinks;
        this.contribution = {} as Contribution;
        this.info = { imagesUrls: [], urls: [] } as EditablePublicPointData;
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
                let newFeature = {
                    type: "Feature",
                    properties: {
                        poiSource: "OSM",
                        poiId: "",
                        identifier: ""
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    }
                } as GeoJSON.Feature;
                this.mergeDataIfNeededData(newFeature);
            } else {
                let feature = await this.poiService.getPoint(data.id, data.source, data.language);
                this.originalLocation = this.poiService.getLocation(feature);
                this.mergeDataIfNeededData(feature);
                let bounds = SpatialService.getBoundsForFeature(feature);
                this.fitBoundsService.fitBounds(bounds);
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

    private async mergeDataIfNeededData(feature: GeoJSON.Feature) {
        let uploadMarkerData = this.ngRedux.getState().poiState.uploadMarkerData;
        if (uploadMarkerData != null) {
            this.poiService.mergeWithPoi(feature, uploadMarkerData);
            this.ngRedux.dispatch(new SetUploadMarkerDataAction({
                markerData: null
            }));
            if (feature.properties.poiId && feature.geometry.type === "Point") {
                this.showLocationUpdate = true;
            }
        }
        this.initFromFeature(feature);
    }

    private initFromFeature(feature: GeoJSON.Feature) {
        this.poiExtended = feature;
        this.latlng = this.poiService.getLocation(feature);
        this.sourceImageUrls = Object.keys(feature.properties).filter(k => k.startsWith("poiSourceImageUrl")).map(k => feature.properties[k]);
        this.shareLinks = this.poiService.getPoiSocialLinks(feature);
        this.contribution = this.poiService.getContribution(feature);
        this.itmCoordinates = this.poiService.getItmCoordinates(feature);
        
        let language = this.resources.getCurrentLanguageCodeSimplified();
        this.info = {
            id: feature.properties.poiId,
            category: this.poiExtended.properties.poiCategory,
            description: this.poiService.getDescription(feature, language),
            title: this.poiService.getTitle(feature, language),
            icon: feature.properties.poiIcon,
            iconColor: feature.properties.poiIconColor,
            imagesUrls: Object.keys(feature.properties).filter(k => k.startsWith("image")).map(k => feature.properties[k]),
            urls: Object.keys(feature.properties).filter(k => k.startsWith("website")).map(k => feature.properties[k]),
            isPoint: feature.geometry.type === "Point" || feature.geometry.type === "MultiPoint"
        }
    }

    public isHideEditMode(): boolean {
        return !this.authorizationService.isLoggedIn() ||
            !this.poiExtended ||
            !this.isEditable() ||
            this.editMode;
    }

    public getDescription(): string {
        if (!this.poiExtended) {
            return "";
        }
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let description = this.poiService.getDescription(this.poiExtended, language) ||
            this.poiService.getExternalDescription(this.poiExtended, language);
        if (description) {
            return description;
        }
        if (!this.isEditable()) {
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
        this.router.navigate([RouteStrings.ROUTE_POI, this.poiExtended.properties.poiSource, this.poiExtended.properties.identifier],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
    }

    public isEditable() {
        return this.poiExtended && this.poiExtended.properties.poiSource === "OSM";
    }

    public isRoute() {
        return this.poiExtended && (this.poiExtended.geometry.type === "LineString" || this.poiExtended.geometry.type === "MultiLineString");
    }

    public getIcon() {
        if (!this.isEditable()) {
            return this.poiExtended.properties.poiIcon;
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
            let language = this.resources.getCurrentLanguageCodeSimplified();
            let featureToUpload = cloneDeep(this.poiExtended);
            if (!this.updateLocation && this.info.id) {
                this.poiService.setLocation(featureToUpload, this.originalLocation);
            }
            this.poiService.setDescription(featureToUpload, this.info.description, language);
            this.poiService.setTitle(featureToUpload, this.info.title, language);
            // HM TODO: set icon...
            // HM TODO: set images...
            // HM TODO: set urls...
            // HM TODO: check ids throught the app with this change
            this.originalLocation = null;
            let feature = await this.poiService.uploadPoint(featureToUpload);
            this.initFromFeature(feature);
            this.toastService.info(this.resources.dataUpdatedSuccessfully);
            this.router.navigate([RouteStrings.ROUTE_POI, this.poiExtended.properties.poiSource, this.poiExtended.properties.identifier],
                { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
        } catch (ex) {
            this.toastService.confirm({ message: this.resources.unableToSaveData, type: "Ok" });
        } finally {
            this.isLoading = false;
        }
    }

    public convertToRoute() {
        let routesCopy = this.geoJsonParser.toDataContainer({
            type: "FeatureCollection",
            features: [this.poiExtended]
        }).routes;
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
            icon = this.poiExtended.properties.poiIcon;
            id = this.poiExtended.properties.identifier;
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
        let location = this.poiService.getLocation(this.poiExtended);
        let title = this.poiService.getTitle(this.poiExtended, this.resources.getCurrentLanguageCodeSimplified());
        this.navigateHereService.addNavigationSegment(location, title);
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
        for (let url of this.info.urls) {
            urls.push({
                mimeType: "text/html",
                text: this.info.title,
                url
            });
        }
        if (!this.poiExtended) {
            return urls;
        }
        let imageUrls = Object.keys(this.poiExtended.properties).filter(k => k.startsWith("image")).map(k => this.poiExtended.properties[k]);
        for (let imageUrl of imageUrls) {
            urls.push({
                mimeType: `image/${imageUrl.split(".").pop().replace("jpg", "jpeg")}`,
                text: "",
                url: imageUrl
            });
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
        if (!this.isEditable()) {
            return null;
        }
        return this.authorizationService.getElementOsmAddress(this.poiExtended.properties.identifier);
    }
}
