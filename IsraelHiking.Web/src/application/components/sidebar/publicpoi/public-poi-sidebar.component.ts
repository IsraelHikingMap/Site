import { Component, OnDestroy, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router, ActivatedRoute, ParamMap } from "@angular/router";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { Observable } from "rxjs";
import { cloneDeep } from "lodash-es";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../../base-map.component";
import { ResourcesService } from "../../../services/resources.service";
import { PoiService, PoiSocialLinks } from "../../../services/poi.service";
import { AuthorizationService } from "../../../services/authorization.service";
import { IHMTitleService } from "../../../services/ihm-title.service";
import { ToastService } from "../../../services/toast.service";
import { HashService, RouteStrings, PoiRouterData } from "../../../services/hash.service";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { RoutesFactory } from "../../../services/routes.factory";
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
    Contribution,
    LatLngAltTime
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
    public isOpen$: Observable<boolean>;

    private editMode: boolean;
    private fullFeature: GeoJSON.Feature;

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
                private readonly store: Store) {
        super(resources);
        this.sidebarService.hideWithoutChangingAddressbar();
        this.isLoading = true;
        this.showLocationUpdate = false;
        this.updateLocation = false;
        this.shareLinks = {} as PoiSocialLinks;
        this.contribution = {} as Contribution;
        this.info = { imagesUrls: [], urls: [] } as EditablePublicPointData;
        this.isOpen$ = this.store.select((state: ApplicationState) => state.poiState.isSidebarOpen);
        this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(async (_) => {
            if (!this.router.url.startsWith(RouteStrings.ROUTE_POI)) {
                return;
            }
            const snapshot = this.route.snapshot;
            const poiSourceAndId = this.getDataFromRoute(snapshot.paramMap, snapshot.queryParamMap);
            if (snapshot.queryParamMap.get(RouteStrings.EDIT) !== "true" || poiSourceAndId.source === "new") {
                await this.fillUiWithData(poiSourceAndId);
            }
        });
        this.route.queryParams.pipe(takeUntilDestroyed()).subscribe(async (params) => {
            if (!this.router.url.startsWith(RouteStrings.ROUTE_POI)) {
                return;
            }
            const editMode = params[RouteStrings.EDIT] === "true";
            const snapshot = this.route.snapshot;
            const poiSourceAndId = this.getDataFromRoute(snapshot.paramMap, snapshot.queryParamMap);
            if (editMode && poiSourceAndId.source !== "new") {
                await this.fillUiWithData(poiSourceAndId);
            }
            // change this only after we get the full data
            // so that the edit dialog will have all the necessary data to decide
            this.editMode = editMode;
        });
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
    }

    public isApp(): boolean {
        return this.runningContextSerivce.isCapacitor;
    }

    private async fillUiWithData(data: PoiRouterData) {
        try {
            this.store.dispatch(new SetSidebarAction(true));
            if (data.source === "new") {
                const newFeature = {
                    id: "",
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
                const feature = await this.poiService.getPoint(data.id, data.source, data.language);
                const originalFeature = cloneDeep(feature);
                this.mergeDataIfNeededData(feature);
                const bounds = SpatialService.getBoundsForFeature(feature);
                this.fitBoundsService.fitBounds(bounds);
                this.store.dispatch(new SetSelectedPoiAction(originalFeature));
                if (data.source === RouteStrings.COORDINATES) {
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
        const uploadMarkerData = this.store.selectSnapshot((s: ApplicationState) => s.poiState).uploadMarkerData;
        if (uploadMarkerData != null) {
            this.poiService.mergeWithPoi(feature, uploadMarkerData);
            this.store.dispatch(new SetUploadMarkerDataAction(null));
            if (this.poiService.getFeatureId(feature) && feature.geometry.type === "Point") {
                this.showLocationUpdate = true;
            }
        }
        this.initFromFeature(feature);
    }

    private initFromFeature(feature: GeoJSON.Feature) {
        this.fullFeature = feature;
        this.latlng = this.poiService.getLocation(feature);
        this.sourceImageUrls = this.getSourceImageUrls(feature);
        this.shareLinks = this.poiService.getPoiSocialLinks(feature);
        this.contribution = this.poiService.getContribution(feature);
        this.info = this.poiService.getEditableDataFromFeature(feature);
        const language = this.resources.getCurrentLanguageCodeSimplified();
        this.titleService.set(this.poiService.getTitle(feature, language));
    }

    private getSourceImageUrls(feature: GeoJSON.Feature): SourceImageUrlPair[] {
        return Object.keys(feature.properties).filter(k => k.startsWith("website")).map(k => {
            let url = feature.properties[k] as string;
            let imageUrl = feature.properties[k.replace("website", "poiSourceImageUrl")] as string;
            if (!imageUrl) {
                if (url.includes("kkl.org.il")) {
                    imageUrl = "https://www.kkl.org.il/education/files/about/symbols/kkl_logo440.jpg";
                } else if (url.includes("inature.info")) {
                    imageUrl = "https://user-images.githubusercontent.com/3269297/37312048-2d6e7488-2652-11e8-9dbe-c1465ff2e197.png";
                } else if (url.includes("ibt.org.il")) {
                    imageUrl = "https://ibt.org.il/images/logo.png";
                } else {
                    const domain = new URL(url).hostname;
                    imageUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
                }
            }
            if (this.isBadWikipediaUrl(url)) {
                url = null;
            }
            return {
                imageUrl,
                url
            } as SourceImageUrlPair;
        }).filter(iup => iup.url != null);
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
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const description = this.poiService.getDescription(this.fullFeature, language) ||
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
        return this.fullFeature && this.fullFeature.properties.poiSource !== RouteStrings.COORDINATES;
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
        const routes = this.geoJsonParser.toRoutes(this.fullFeature as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>);
        for (const route of routes) {
            const name = this.selectedRouteService.createRouteName(route.name);
            const newRoute = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
            newRoute.description = this.info.description;
            newRoute.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(route.latlngs as LatLngAltTime[], "Hike");
            this.store.dispatch(new AddRouteAction(newRoute));
            this.selectedRouteService.setSelectedRoute(newRoute.id);
        }
        this.clear();
    }

    public async addPointToRoute() {
        const selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        let icon = "icon-star";
        let id = "";
        if (this.fullFeature) {
            icon = this.fullFeature.properties.poiIcon;
            id = this.fullFeature.properties.identifier;
        }
        const urls = this.getUrls();
        this.store.dispatch(new AddPrivatePoiAction(selectedRoute.id, {
            latlng: this.latlng,
            title: this.info.title,
            description: this.info.description,
            type: icon.replace("icon-", ""),
            id,
            urls
        }));
        this.clear();
    }

    public navigateHere() {
        const location = this.poiService.getLocation(this.fullFeature);
        const title = this.poiService.getTitle(this.fullFeature, this.resources.getCurrentLanguageCodeSimplified());
        this.navigateHereService.addNavigationSegment(location, title);
    }

    public clear() {
        if (this.fullFeature) {
            this.store.dispatch(new SetSelectedPoiAction(null));
        }
        this.close();
    }

    private getUrls(): LinkData[] {
        const urls = [] as LinkData[];
        for (const url of this.info.urls) {
            urls.push({
                mimeType: "text/html",
                text: this.info.title,
                url
            });
        }
        if (!this.fullFeature) {
            return urls;
        }
        const imageUrls = Object.keys(this.fullFeature.properties)
            .filter(k => k.startsWith("image"))
            .map(k => this.fullFeature.properties[k]);
        for (const imageUrl of imageUrls) {
            urls.push({
                mimeType: `image/${imageUrl.split(".").pop().replace("jpg", "jpeg")}`,
                text: "",
                url: imageUrl
            });
        }
        return urls;
    }

    public close() {
        this.store.dispatch(new SetSidebarAction(false));
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
        const language = this.resources.getCurrentLanguageCodeSimplified();
        return url == null || (url.includes("wikipedia") && !url.includes(language + ".wikipedia"));
    }
}
