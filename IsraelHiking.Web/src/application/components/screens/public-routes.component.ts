import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { NgClass } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { GeoJSONSourceComponent, MapComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkersForClustersComponent, PointDirective, ClusterPointDirective, ControlComponent } from "@maplibre/ngx-maplibre-gl";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";
import { MatButton } from "@angular/material/button";
import { FormsModule } from "@angular/forms";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { AnalyticsDirective } from "../../directives/analytics.directive";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { Share } from "@capacitor/share";
import { orderBy } from "lodash-es";
import { skip } from "rxjs";
import { AnimationOptions, LottieComponent } from "ngx-lottie";
import type { StyleSpecification, Map, MapSourceDataEvent, FilterSpecification } from "maplibre-gl";

import { ImageAttributionComponent } from "../image-attribution.component";
import { ZoomComponent } from "../zoom.component";
import { OsmAttributionComponent } from "../osm-attribution.component";
import { PublicRoutesFilterComponent } from "../public-routes-filter.component";
import { DescriptionComponent } from "../description.component";
import { DistancePipe } from "../../pipes/distance.pipe";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersComponent } from "../map/layers.component";
import { MapService } from "../../services/map.service";
import { ResourcesService } from "../../services/resources.service";
import { PoiService } from "../../services/poi.service";
import { SpatialService } from "../../services/spatial.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { RunningContextService } from "../../services/running-context.service";
import { TranslationService } from "../../services/translation.service";
import { GeoJSONUtils } from "../../services/geojson-utils";
import { PoiProperties } from "../../services/osm-tags.service";
import { RouteStrings } from "../../services/hash.service";
import { initialState } from "../../reducers/initial-state";
import { Urls } from "../../urls";
import type { ApplicationState } from "../../models";

@Component({
    selector: "public-routes",
    templateUrl: "./public-routes.component.html",
    styleUrls: ["./public-routes.component.scss"],
    imports: [Dir, MapComponent, LayersComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkersForClustersComponent, PointDirective, ClusterPointDirective, MatButton, FormsModule, MatButtonToggleGroup, MatButtonToggle, AnalyticsDirective, NgClass, MatMenuTrigger, MatMenuItem, MatMenu, DistancePipe, GeoJSONSourceComponent, LayerComponent, CdkCopyToClipboard, ImageAttributionComponent, ZoomComponent, OsmAttributionComponent, ControlComponent, PublicRoutesFilterComponent, DescriptionComponent, LottieComponent]
})
export class PublicRoutesComponent {
    public readonly lottieScenery: AnimationOptions = {
        path: "content/lottie/placeholder-scenery.json"
    };
    public readonly mapStyle: StyleSpecification;
    public readonly showMap = signal(true);
    public readonly routesSrouceId = "routes-of-interest";
    public readonly routesClusterSourceId = "routes-cluster-source";
    public readonly minZoom = 8;

    /**
     * How many routes the list shows at most, above which it only says there are too many: every route
     * is a card of its own with an image and a menu, and a list of thousands of them takes the screen
     * apart rather than being of any use. The map keeps showing them all, clustered.
     */
    private static readonly MAX_ROUTES_IN_LIST = 500;

    /**
     * Keeps the points this screen never shows out of the reading of the tiles: a tile of a dense area
     * holds tens of thousands of points and only a fraction of them are routes, and every one that is
     * read is converted and thrown away on every map movement.
     */
    private static readonly ROUTE_CATEGORIES_FILTER: FilterSpecification =
        ["in", ["get", "poiCategory"], ["literal", ["Hiking", "Bicycle", "4x4"]]];

    public readonly poisVectorTileAddress = [Urls.baseTilesAddress.replace("https://", "slice://") + "/vector/data/global_points/{z}/{x}/{y}.mvt"];
    public readonly poiGeoJsonData = signal<GeoJSON.FeatureCollection<GeoJSON.Point, PoiProperties>>({
        type: "FeatureCollection",
        features: []
    });
    public readonly hoverFeature = signal<GeoJSON.Feature<GeoJSON.Point>>(null);
    public readonly selectedRouteGeoJson = signal<GeoJSON.FeatureCollection>({
        type: "FeatureCollection",
        features: []
    });
    public readonly selectedRoutePoint = signal<GeoJSON.Feature<GeoJSON.Point, PoiProperties>>(null);

    /**
     * The routes the map holds, kept since a small screen shows either the map or the list, and a map
     * that is not displayed holds nothing, which would empty the list the moment a filter changes.
     */
    private routesFromTiles: GeoJSON.Feature<GeoJSON.Point, PoiProperties>[] = [];

    public readonly resources = inject(ResourcesService);

    /** Whether the map is too far out for the routes tiles, which is why the screen shows nothing */
    public readonly isZoomedOut = computed(() => this.zoom() < this.minZoom);

    /** Whether there are more routes than the list shows, see {@link MAX_ROUTES_IN_LIST} */
    public readonly hasTooManyRoutes = computed(() =>
        this.poiGeoJsonData().features.length > PublicRoutesComponent.MAX_ROUTES_IN_LIST);

    /** Whether any filter is set to something other than what the screen starts with */
    public readonly isFiltered = computed(() => {
        const filters = this.filters();
        const initialFilters = initialState.inMemoryState.publicRoutesFilter;
        return filters.categories.length !== initialFilters.categories.length ||
            filters.difficulty.length !== initialFilters.difficulty.length ||
            filters.lengthRange[0] !== initialFilters.lengthRange[0] ||
            filters.lengthRange[1] !== initialFilters.lengthRange[1] ||
            filters.userId != null;
    });

    private readonly mapService = inject(MapService);
    private readonly poiService = inject(PoiService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly store = inject(Store);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly router = inject(Router);
    private readonly runningContextSerivce = inject(RunningContextService);
    private readonly translationService = inject(TranslationService);

    private readonly zoom = this.store.selectSignal((s: ApplicationState) => s.locationState.zoom);
    private readonly filters = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.publicRoutesFilter);

    constructor() {
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        const locationState = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.mapStyle.zoom = locationState.zoom;
        this.mapStyle.center = [locationState.longitude, locationState.latitude];
        this.store.select((state: ApplicationState) => state.locationState).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.runFilter();
        });
        this.store.select((state: ApplicationState) => state.inMemoryState.publicRoutesFilter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.runFilter();
        });
        this.store.select((state: ApplicationState) => state.configuration.language)
            .pipe(takeUntilDestroyed(this.destroyRef), skip(1)).subscribe(() => {
                this.runFilter();
            });
        this.destroyRef.onDestroy(() => {
            this.mapService.unsetMap();
        });
    }

    public mapLoaded(map: Map) {
        this.mapService.setMap(map);
        this.mapService.addArrowToMap(map);
        this.runFilter();
        map.on("sourcedata", (e) => this.onSourceData(e, map))
    }

    private onSourceData(e: MapSourceDataEvent, map: Map) {
        if (e.sourceId === this.routesSrouceId) {
            this.runFilter();
            map.off("sourcedata", (e) => this.onSourceData(e, map))
        }
    }

    public runFilter() {
        if (this.showMap()) {
            this.routesFromTiles = this.poiService.getPoisFromTiles(PublicRoutesComponent.ROUTE_CATEGORIES_FILTER);
        }
        const filters = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter);
        let features = this.poiService.getPublicRoutes(filters, this.routesFromTiles).features;
        const sortBy = [(f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => f.properties.poiLength];
        features = orderBy(features, sortBy, ["desc"]);
        this.poiGeoJsonData.set({
            type: "FeatureCollection",
            features
        });
    }

    public async onStartPointClick(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>, event: MouseEvent) {
        event.stopPropagation();
        if (this.selectedRoutePoint()?.properties.poiId === feature.properties.poiId) {
            this.selectedRoutePoint.set(null);
            this.selectedRouteGeoJson.set({
                type: "FeatureCollection",
                features: []
            });
            this.hoverFeature.set(null);
            return;
        }
        ScrollToDirective.scrollTo(`route-${feature.properties.poiId}`, 60);
        this.moveToFeature(feature);
    }

    public async moveToFeature(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) {
        this.showMap.set(true);
        this.selectedRoutePoint.set(feature);
        this.hoverFeature.set(null);
        const fullFeature = await this.poiService.getBasicInfo(feature.properties.identifier, feature.properties.poiSource, this.resources.getCurrentLanguageCodeSimplified());
        this.selectedRouteGeoJson.set({
            type: "FeatureCollection",
            features: [fullFeature]
        });
        if (feature.properties.poiSource === "OSM") {
            await this.poiService.updateExtendedInfo(fullFeature, this.resources.getCurrentLanguageCodeSimplified());
            this.selectedRouteGeoJson.set({
                type: "FeatureCollection",
                features: [fullFeature]
            });
        }
        const bounds = SpatialService.getBoundsForFeature(fullFeature);
        this.mapService.fitBounds(bounds, 100, { top: 100, left: 50, bottom: window.innerHeight / 2, right: 50 });
    }

    public getTitle(feature: GeoJSON.Feature<GeoJSON.Point>) {
        return GeoJSONUtils.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hover(feature: GeoJSON.Feature<GeoJSON.Point>) {
        this.hoverFeature.set(feature);
    }

    /**
     * Opens a cluster by moving to the zoom at which it breaks apart, since a filter can leave
     * hundreds of routes in one place and a list of them all is of no use on the map.
     */
    public async zoomToCluster(feature: GeoJSON.Feature<GeoJSON.Point>, source: GeoJSONSourceComponent) {
        const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
        await this.mapService.flyTo(SpatialService.toLatLng(feature.geometry.coordinates as [number, number]), zoom);
    }

    public onSortChange() {
        this.runFilter();
    }


    public getIconFromType(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) {
        switch (feature.properties.poiCategory) {
            case "Hiking":
                return "icon-hike";
            case "Bicycle":
                return "icon-bike";
            case "4x4":
                return "icon-four-by-four";
            case "Unknown":
            default:
                return "icon-question";
        }
    }

    public async convertToRoute(feature: GeoJSON.Feature<GeoJSON.Point>) {
        const fullFeature = await this.poiService.getBasicInfo(feature.properties.identifier, feature.properties.poiSource, this.resources.getCurrentLanguageCodeSimplified());
        if (feature.properties.poiSource === "OSM") {
            await this.poiService.updateExtendedInfo(fullFeature, this.resources.getCurrentLanguageCodeSimplified());
        }
        this.selectedRouteService.convertToRoute(fullFeature, this.translationService.getBestDescription(feature));
        this.router.navigate([RouteStrings.MAP]);
        // This is to let the route change to the map so that the relevant map will be used for fit bounds.
        await new Promise((resolve) => setTimeout(resolve, 100));
        const bounds = SpatialService.getBoundsForFeature(fullFeature);
        this.mapService.fitBounds(bounds);
    }

    public isApp() {
        return this.runningContextSerivce.isCapacitor;
    }

    public getShareLinks(feature: GeoJSON.Feature<GeoJSON.Point>) {
        return this.poiService.getPoiSocialLinks(feature);
    }

    public share(poiLink: string) {
        Share.share({
            url: poiLink
        });
    }

    public isFromOsm(route: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) {
        return route.properties.poiSource === "OSM";
    }

    /**
     * Moves to the plan & explore screen with this route's point of interest open, which is where its
     * full details are, the link to it in OSM included.
     */
    public navigateToPoi(route: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) {
        this.router.navigate([RouteStrings.ROUTE_POI, route.properties.poiSource, route.properties.identifier]);
    }

    public navigateToEditPoi(route: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) {
        this.router.navigate([RouteStrings.ROUTE_POI, route.properties.poiSource, route.properties.identifier],
            { queryParams: { edit: true } });
    }
}