import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";
import { SocialSharing } from "@ionic-native/social-sharing/ngx";
import { Subscription, Observable } from "rxjs";
import { cloneDeep } from "lodash-es";
import { NgRedux, select } from "@angular-redux2/store";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { PoiService, PoiSocialLinks } from "../../../services/poi.service";
import { AuthorizationService } from "../../../services/authorization.service";
import { IHMTitleService } from "../../../services/ihm-title.service";
import { ToastService } from "../../../services/toast.service";
import { HashService, RouteStrings, PoiRouterData } from "../../../services/hash.service";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { RoutesFactory } from "../../../services/layers/routelayers/routes.factory";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SpatialService } from "../../../services/spatial.service";
import { RunningContextService } from "../../../services/running-context.service";
import { SidebarService } from "../../../services/sidebar.service";
import { NavigateHereService } from "../../../services/navigate-here.service";
import { GpxDataContainerConverterService } from "../../../services/gpx-data-container-converter.service";
import { GeoJsonParser } from "../../../services/geojson.parser";
import { sidebarAnimate } from "../sidebar.component";
import { AddRouteAction, AddPrivatePoiAction } from "../../../reducers/routes.reducer";
import { SetSelectedPoiAction, SetUploadMarkerDataAction, SetSidebarAction } from "../../../reducers/poi.reducer";
import type {
    LinkData,
    LatLngAlt,
    ApplicationState,
    EditablePublicPointData,
    Contribution
} from "../../../models/models";

export type SourceImageUrlPair = {
    imageUrl: string;
    url: string;
};

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
    public sourceImageUrls: SourceImageUrlPair[];
    public latlng: LatLngAlt;
    public shareLinks: PoiSocialLinks;
    public contribution: Contribution;

    @select((state: ApplicationState) => state.poiState.isSidebarOpen)
    public isOpen: Observable<boolean>;

    private editMode: boolean;
    private fullFeature: GeoJSON.Feature;
    private subscriptions: Subscription[];

    constructor(resources: ResourcesService,
                private readonly titleService: IHMTitleService,
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
                private readonly socialSharing: SocialSharing,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.sidebarService.hideWithoutChangingAddressbar();
        this.isLoading = true;
        this.showLocationUpdate = false;
        this.updateLocation = false;
        this.shareLinks = {} as PoiSocialLinks;
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
                await this.fillUiWithData(poiSourceAndId);
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
                await this.fillUiWithData(poiSourceAndId);
            }
            // change this only after we get the full data
            // so that the edit dialog will have all the necessary data to decide
            this.editMode = editMode;
        }));
    }

    private getDataFromRoute(params: ParamMap, queryParams: ParamMap) {
        return {
            id: params.get(RouteStrings.ID),
            source: params.get(RouteStrings.SOURCE),
            language: queryParams.get(RouteStrings.LANGUAGE)
        } as PoiRouterData;
    }

    public ngOnDestroy() {
        this.titleService.clear();

        for (let subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    public isApp(): boolean {
        return this.runningContextSerivce.isCordova;
    }

    private async fillUiWithData(data: PoiRouterData) {
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
                let originalFeature = cloneDeep(feature);
                this.mergeDataIfNeededData(feature);
                let bounds = SpatialService.getBoundsForFeature(feature);
                this.fitBoundsService.fitBounds(bounds);
                this.ngRedux.dispatch(new SetSelectedPoiAction({
                    poi: originalFeature
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
        this.fullFeature = feature;
        this.latlng = this.poiService.getLocation(feature);
        this.sourceImageUrls = Object.keys(feature.properties).filter(k => k.startsWith("website")).map(k => {
            let url = feature.properties[k];
            let imageUrl = feature.properties[k.replace("website", "poiSourceImageUrl")] as string;
            if (this.isBadWikipediaUrl(url)) {
                url = null;
            }
            return {
                imageUrl,
                url
            } as SourceImageUrlPair;
        }).filter(iup => iup.url != null);
        this.shareLinks = this.poiService.getPoiSocialLinks(feature);
        this.contribution = this.poiService.getContribution(feature);
        this.info = this.poiService.getEditableDataFromFeature(feature);
        const language = this.resources.getCurrentLanguageCodeSimplified();
        this.titleService.set(this.poiService.getTitle(feature, language));
    }

    public isHideEditMode(): boolean {
        return !this.authorizationService.isLoggedIn() ||
            !this.fullFeature ||
            !this.isEditable() ||
            this.editMode;
    }

    public getDescription(): string {
        if (!this.fullFeature) {
            return "";
        }
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let description = this.poiService.getDescription(this.fullFeature, language) ||
            this.poiService.getExternalDescription(this.fullFeature, language);
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
        this.router.navigate([RouteStrings.ROUTE_POI, this.fullFeature.properties.poiSource, this.fullFeature.properties.identifier],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified(), edit: true } });
    }

    public isEditable() {
        return this.fullFeature && this.fullFeature.properties.poiSource === "OSM";
    }

    public isShowSeeAlso() {
        return this.fullFeature && this.fullFeature.properties.poiSource !== "Coordinates";
    }

    public isRoute() {
        return this.fullFeature && (this.fullFeature.geometry.type === "LineString" ||
            this.fullFeature.geometry.type === "MultiLineString");
    }

    public getIcon() {
        if (!this.isEditable()) {
            return this.fullFeature.properties.poiIcon;
        }
        return "icon-camera";
    }

    public async save() {
        this.isLoading = true;
        try {
            if (!this.info.id) {
                await this.poiService.addComplexPoi(this.info, this.latlng);
            } else {
                await this.poiService.updateComplexPoi(this.info, this.updateLocation ? this.latlng : null);
            }
            this.toastService.success(this.resources.dataUpdatedSuccessfullyItWillTakeTimeToSeeIt);
            this.clear();
        } catch (ex) {
            this.toastService.confirm({ message: this.resources.unableToSaveData, type: "Ok" });
        } finally {
            this.isLoading = false;
        }
    }

    public convertToRoute() {
        let routesCopy = this.geoJsonParser.toDataContainer({
            type: "FeatureCollection",
            features: [this.fullFeature]
        }).routes;
        for (let routeData of routesCopy) {
            let name = this.selectedRouteService.createRouteName(routeData.name);
            let newRoute = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
            newRoute.description = this.info.description;
            newRoute.segments = routeData.segments;
            newRoute.markers = routeData.markers;
            GpxDataContainerConverterService.SplitRouteSegments(newRoute);
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
        if (this.fullFeature) {
            icon = this.fullFeature.properties.poiIcon;
            id = this.fullFeature.properties.identifier;
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
        let location = this.poiService.getLocation(this.fullFeature);
        let title = this.poiService.getTitle(this.fullFeature, this.resources.getCurrentLanguageCodeSimplified());
        this.navigateHereService.addNavigationSegment(location, title);
    }

    public clear() {
        if (this.fullFeature) {
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
        if (!this.fullFeature) {
            return urls;
        }
        let imageUrls = Object.keys(this.fullFeature.properties)
            .filter(k => k.startsWith("image"))
            .map(k => this.fullFeature.properties[k]);
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
        if (!this.fullFeature) {
            return null;
        }
        if (!this.isEditable()) {
            return null;
        }
        return this.authorizationService.getElementOsmAddress(this.fullFeature.properties.identifier);
    }

    public share() {
        this.socialSharing.shareWithOptions({
            url: this.shareLinks.poiLink
        });
    }

    public hasUrl(): boolean {
        return this.getUrl() != null;
    }

    public getUrl(): string {
        if (this.info.urls == null) {
            return null;
        }
        return this.info.urls.find(u => !this.isBadWikipediaUrl(u));
    }

    private isBadWikipediaUrl(url: string) {
        let language = this.resources.getCurrentLanguageCodeSimplified();
        return url == null || (url.includes("wikipedia") && !url.includes(language + ".wikipedia"));
    }
}
