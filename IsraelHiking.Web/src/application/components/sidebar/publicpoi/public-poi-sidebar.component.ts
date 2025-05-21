import { Component, inject, OnDestroy, ViewEncapsulation } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Dir } from "@angular/cdk/bidi";
import { NgIf, NgClass, NgFor, DecimalPipe } from "@angular/common";
import { MatButton, MatAnchor } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatCard, MatCardHeader, MatCardTitle, MatCardContent } from "@angular/material/card";
import { MatCheckbox } from "@angular/material/checkbox";
import { FormsModule } from "@angular/forms";
import { Router, NavigationEnd } from "@angular/router";
import { Angulartics2OnModule } from "angulartics2";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { filter, skip } from "rxjs";
import { Store } from "@ngxs/store";

import { PublicPointOfInterestEditComponent } from "./public-poi-edit.component";
import { ImageScrollerComponent } from "./image-scroller.component";
import { ResourcesService } from "../../../services/resources.service";
import { PoiService, PoiSocialLinks } from "../../../services/poi.service";
import { IHMTitleService } from "../../../services/ihm-title.service";
import { ToastService } from "../../../services/toast.service";
import { RouteStrings, PoiRouteUrlInfo } from "../../../services/hash.service";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SpatialService } from "../../../services/spatial.service";
import { RunningContextService } from "../../../services/running-context.service";
import { SidebarService } from "../../../services/sidebar.service";
import { NavigateHereService } from "../../../services/navigate-here.service";
import { GpxDataContainerConverterService } from "../../../services/gpx-data-container-converter.service";
import { OsmAddressesService } from "../../../services/osm-addresses.service";
import { ElevationProvider } from "../../../services/elevation.provider";
import { GeoJsonParser } from "../../../services/geojson.parser";
import { AddRouteAction, AddPrivatePoiAction } from "../../../reducers/routes.reducer";
import { SetSelectedPoiAction } from "../../../reducers/poi.reducer";
import { GeoJSONUtils } from "../../../services/geojson-utils";
import type {
    LinkData,
    LatLngAlt,
    ApplicationState,
    EditablePublicPointData,
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
    imports: [Dir, NgIf, MatButton, Angulartics2OnModule, MatTooltip, MatMenu, MatMenuItem, MatAnchor, CdkCopyToClipboard, MatMenuTrigger, MatProgressSpinner, MatCard, PublicPointOfInterestEditComponent, MatCheckbox, FormsModule, MatCardHeader, MatCardTitle, NgClass, MatCardContent, ImageScrollerComponent, NgFor, DecimalPipe]
})
export class PublicPoiSidebarComponent implements OnDestroy {
    public info = { imagesUrls: [], urls: [] } as EditablePublicPointData;
    public isLoading: boolean = true;
    public isMinimized: boolean = false;
    public showLocationUpdate: boolean = false;
    public updateLocation: boolean = false;
    public sourceImageUrls: SourceImageUrlPair[];
    public latlng: LatLngAlt;
    public shareLinks = {} as PoiSocialLinks;

    private editMode: boolean;
    private fullFeature: GeoJSON.Feature;

    public readonly resources = inject(ResourcesService);

    private readonly titleService = inject(IHMTitleService);
    private readonly router = inject(Router);
    private readonly poiService = inject(PoiService);
    private readonly osmAddressesService = inject(OsmAddressesService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly toastService = inject(ToastService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly sidebarService = inject(SidebarService);
    private readonly runningContextSerivce = inject(RunningContextService);
    private readonly navigateHereService = inject(NavigateHereService);
    private readonly geoJsonParser = inject(GeoJsonParser);
    private readonly socialSharing = inject(SocialSharing);
    private readonly elevasionProvider = inject(ElevationProvider);
    private readonly store = inject(Store);

    constructor() {
        this.router.events.pipe(
            takeUntilDestroyed(),
            filter(event => event instanceof NavigationEnd && event.url.startsWith(RouteStrings.ROUTE_POI))
          ).subscribe(async () => {
            this.isLoading = true;
            await this.initOrUpdate();
        });
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed(), skip(1)).subscribe(() => {
            const sourceIdAndLanguage = this.getRouteUrlInfo();
            const queryParams: Record<string, string | boolean> = {
                language: this.resources.getCurrentLanguageCodeSimplified()
            };
            if (sourceIdAndLanguage.editMode) {
                queryParams.edit = true;
            }
            this.router.navigate([RouteStrings.ROUTE_POI, sourceIdAndLanguage.source, sourceIdAndLanguage.id], { queryParams });
        });
        this.initOrUpdate();
    }

    private getRouteUrlInfo(): PoiRouteUrlInfo {
        const parsed = this.router.parseUrl(this.router.url);
        return {
            source: parsed.root.children.primary.segments[1].path,
            id: parsed.root.children.primary.segments[2]?.path,
            language: parsed.queryParams[RouteStrings.LANGUAGE],
            editMode: parsed.queryParams[RouteStrings.EDIT] === "true"
        }
    }

    private async initOrUpdate() {
        
        const routeUrlInfo = this.getRouteUrlInfo();
        await this.fillUiWithData(routeUrlInfo);
        // change this only after we get the full data
        // so that the edit dialog will have all the necessary data to decide
        this.editMode = routeUrlInfo.editMode;
    }

    public ngOnDestroy() {
        this.titleService.clear();
        if (this.fullFeature) {
            this.store.dispatch(new SetSelectedPoiAction(null));
        }
    }

    public isApp(): boolean {
        return this.runningContextSerivce.isCapacitor;
    }

    private async fillUiWithData(data: PoiRouteUrlInfo) {
        try {
            const feature = await this.poiService.getBasicInfo(data.id, data.source, data.language);
            if (this.getRouteUrlInfo().id !== data.id) {
                return;
            }
            await this.initFromFeature(feature);
            if (data.source === "OSM") {
                const uploadMarkerData = this.store.selectSnapshot((s: ApplicationState) => s.poiState).uploadMarkerData;
                if (feature.geometry.type === "Point" && uploadMarkerData != null) {
                    this.showLocationUpdate = true;
                }
                await this.poiService.updateExtendedInfo(feature, data.language);
                if (this.getRouteUrlInfo().id !== data.id) {
                    return;
                }
                await this.initFromFeature(feature);
            }
            const bounds = SpatialService.getBoundsForFeature(feature);
            this.fitBoundsService.fitBounds(bounds);
            if (data.source === RouteStrings.COORDINATES) {
                this.fullFeature = null;
                this.close();
            }
        } catch {
            this.toastService.warning(this.resources.unableToFindPoi);
            this.close();
        } finally {
            this.isLoading = false;
        }
    }

    private async initFromFeature(feature: GeoJSON.Feature) {
        this.fullFeature = feature;
        this.latlng = GeoJSONUtils.getLocation(feature);
        this.sourceImageUrls = this.getSourceImageUrls(feature);
        this.shareLinks = this.poiService.getPoiSocialLinks(feature);
        this.info = await this.poiService.getEditableDataFromFeature(feature);
        const language = this.resources.getCurrentLanguageCodeSimplified();
        this.titleService.set(GeoJSONUtils.getTitle(feature, language));
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
        const isLoggedOut = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo) == null;
        return isLoggedOut ||
            !this.fullFeature ||
            !this.isEditable() ||
            this.editMode;
    }

    public getDescription(): string {
        if (!this.fullFeature) {
            return "";
        }
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const description = GeoJSONUtils.getDescription(this.fullFeature, language) ||
            GeoJSONUtils.getExternalDescription(this.fullFeature, language);
        if (description) {
            return description;
        }
        if (!this.isEditable()) {
            return description;
        }
        const isLoggedOut = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo) == null;
        if (isLoggedOut) {
            return this.resources.noDescriptionLoginRequired;
        }
        return this.resources.emptyPoiDescription;
    }

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        const isLoggedOut = this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo) == null;
        if (isLoggedOut) {
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
        return this.fullFeature && this.fullFeature.properties.poiSource !== RouteStrings.COORDINATES && (this.sourceImageUrls.length > 0 || this.getElementOsmAddress() != null);
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
            this.close();
        } catch {
            this.toastService.confirm({ message: this.resources.unableToSaveData, type: "Ok" });
        } finally {
            this.isLoading = false;
        }
    }

    public async convertToRoute() {
        const routes = this.geoJsonParser.toRoutes(this.fullFeature as GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>);
        for (const route of routes) {
            const name = this.selectedRouteService.createRouteName(route.name);
            const newRoute = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
            await this.elevasionProvider.updateHeights(route.latlngs);
            newRoute.description = this.info.description;
            newRoute.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(route.latlngs as LatLngAltTime[], "Hike");
            this.store.dispatch(new AddRouteAction(newRoute));
            this.selectedRouteService.setSelectedRoute(newRoute.id);
        }
        this.close();
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
        this.close();
    }

    public navigateHere() {
        const location = GeoJSONUtils.getLocation(this.fullFeature);
        const title = GeoJSONUtils.getTitle(this.fullFeature, this.resources.getCurrentLanguageCodeSimplified());
        this.navigateHereService.addNavigationSegment(location, title);
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
        this.sidebarService.hide();
    }

    public getElementOsmAddress(): string {
        if (!this.fullFeature) {
            return null;
        }
        if (!this.isEditable()) {
            return null;
        }
        return this.osmAddressesService.getElementOsmAddress(this.fullFeature.properties.identifier);
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
