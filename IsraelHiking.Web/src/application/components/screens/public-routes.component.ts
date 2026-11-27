import { Component, computed, DestroyRef, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { NgClass, NgTemplateOutlet } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { GeoJSONSourceComponent, MapComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent, MarkersForClustersComponent, PointDirective, ClusterPointDirective } from "@maplibre/ngx-maplibre-gl";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatCard } from "@angular/material/card";
import { FormsModule } from "@angular/forms";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { AnalyticsDirective } from "../../directives/analytics.directive";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { Share } from "@capacitor/share";
import { orderBy } from "lodash-es";
import { filter, skip } from "rxjs";
import { AnimationOptions, LottieComponent } from "ngx-lottie";
import type { StyleSpecification, Map, MapSourceDataEvent, FilterSpecification, MapLayerMouseEvent } from "maplibre-gl";

import { ImageAttributionComponent } from "../image-attribution.component";
import { ZoomComponent } from "../zoom.component";
import { MapOverlayComponent } from "../map/map-overlay.component";
import { OsmAttributionComponent } from "../osm-attribution.component";
import { PublicRoutesFilterComponent } from "../public-routes-filter.component";
import { DescriptionComponent } from "../description.component";
import { BottomSheetComponent } from "../bottom-sheet.component";
import { RoutesPathComponent } from "../map/routes-path.component";
import { DistancePipe } from "../../pipes/distance.pipe";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersComponent } from "../map/layers.component";
import { MapService } from "../../services/map.service";
import { ResourcesService } from "../../services/resources.service";
import { PoiService } from "../../services/poi.service";
import { SpatialHelper } from "../../services/spatial.helper";
import { END_COLOR, SelectedRouteService, START_COLOR } from "../../services/selected-route.service";
import { RoutesFactory } from "../../services/routes.factory";
import { RunningContextService } from "../../services/running-context.service";
import { TranslationService } from "../../services/translation.service";
import { GeoJSONUtils } from "../../services/geojson-utils";
import { PoiProperties } from "../../services/osm-tags.service";
import { RouteStrings } from "../../services/hash.service";
import { initialState } from "../../reducers/initial-state";
import { SetPublicRoutesSearchResultAction } from "../../reducers/in-memory.reducer";
import { Urls } from "../../urls";
import type { ApplicationState, CategoryType, LatLngAltTime, SearchResultsPointOfInterest } from "../../models";

@Component({
    selector: "public-routes",
    templateUrl: "./public-routes.component.html",
    styleUrls: ["./public-routes.component.scss"],
    imports: [Dir, MapComponent, LayersComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent, MarkersForClustersComponent, PointDirective, ClusterPointDirective, MatButton, FormsModule, MatButtonToggleGroup, MatButtonToggle, AnalyticsDirective, NgClass, MatMenuTrigger, MatMenuItem, MatMenu, DistancePipe, GeoJSONSourceComponent, LayerComponent, CdkCopyToClipboard, ImageAttributionComponent, ZoomComponent, OsmAttributionComponent, MapOverlayComponent, PublicRoutesFilterComponent, DescriptionComponent, LottieComponent, BottomSheetComponent, RoutesPathComponent, MatCard, MatIconButton, NgTemplateOutlet]
})
export class PublicRoutesComponent {
    /** Covers the frame of the image it stands in for, cropping the empty ground at its bottom to keep the sky and the birds */
    public readonly lottieScenery: AnimationOptions = {
        path: "content/lottie/placeholder-scenery.json",
        rendererSettings: { preserveAspectRatio: "xMidYMin slice" }
    };
    public readonly mapStyle: StyleSpecification;
    public readonly showMap = signal(true);
    public readonly routesSrouceId = "routes-of-interest";
    public readonly routesClusterSourceId = "routes-cluster-source";
    public readonly minZoom = 7;

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

    /** The layer of the tiles with the lines of the routes whose trail heads are on the points layer */
    public readonly routesSourceLayer = "global_routes";

    public readonly routeLinesLayer = "public-routes-lines";

    /** The color of a route whose lines the map has not loaded and whose tags give it none */
    private static readonly DEFAULT_ROUTE_COLOR = "magenta";

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
    public readonly selectedRouteId = computed(() => this.selectedRoutePoint()?.properties.poiId);

    /** The place picked in the search, marked on the map once the map got there and found it is not a route */
    public readonly searchedPlace = signal<SearchResultsPointOfInterest>(null);

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

    /**
     * Whether a route is selected that the list does not show, as when fitting the map to a long route
     * brought too many routes into view or zoomed out of the routes tiles, so its card is shown on top.
     */
    public readonly isSelectedRouteUnlisted = computed(() => {
        const selectedId = this.selectedRouteId();
        return selectedId != null && (this.hasTooManyRoutes() || this.isZoomedOut() ||
            !this.poiGeoJsonData().features.some(f => f.properties.poiId === selectedId));
    });

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
    private readonly routesFactory = inject(RoutesFactory);

    private readonly zoom = this.store.selectSignal((s: ApplicationState) => s.locationState.zoom);
    private readonly filters = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.publicRoutesFilter);

    /** The lines the map draws are those of the routes the filters leave in the list */
    public readonly routeLinesFilter = computed(() => this.poiService.getPublicRoutesFilterExpression(this.filters()));
    public readonly hikingLinesFilter = computed(() => this.getCategoryLinesFilter("Hiking"));
    public readonly bicycleLinesFilter = computed(() => this.getCategoryLinesFilter("Bicycle"));
    public readonly fourByFourLinesFilter = computed(() => this.getCategoryLinesFilter("4x4"));
    public readonly cursorStyle = signal("");
    /**
     * Whether the selected marker is where the route starts. A route picked by a line whose trail head
     * is out of view only learns where it starts once it is loaded, and a marker at the click would
     * point at the middle of the route.
     */
    public readonly isAtTrailHead = signal(true);
    private readonly searchResult = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.publicRoutesSearchResult);

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
        this.store.select((state: ApplicationState) => state.inMemoryState.publicRoutesSearchResult)
            .pipe(takeUntilDestroyed(this.destroyRef), filter(searchResult => searchResult != null))
            .subscribe(searchResult => this.onSearchResult(searchResult));
        this.destroyRef.onDestroy(() => {
            this.mapService.unsetMap();
            this.store.dispatch(new SetPublicRoutesSearchResultAction(null));
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

    /**
     * Selects the place picked in the search when it is a route and marks it on the map otherwise, which
     * is only known once the map is idle there, at least at {@link minZoom}, with its tiles read. A map
     * hidden behind the list only gets its size once shown, hence the wait before flying.
     */
    private async onSearchResult(searchResult: SearchResultsPointOfInterest) {
        this.searchedPlace.set(null);
        if (!this.showMap()) {
            this.showMap.set(true);
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        await this.mapService.flyTo(searchResult.location, Math.max(this.zoom(), this.minZoom));
        await this.mapService.waitForIdle();
        this.runFilter();
        if (!this.selectSearchedRoute() && this.searchResult() === searchResult) {
            this.searchedPlace.set(searchResult);
        }
    }

    /**
     * Reads the search result from the state rather than taking it, so that a fly that was overtaken
     * by a newer search does not select the result of the older one.
     */
    private selectSearchedRoute(): boolean {
        const searchResult = this.searchResult();
        if (searchResult == null) {
            return false;
        }
        const route = this.routesFromTiles.find(f =>
            f.properties.poiSource === searchResult.source && f.properties.identifier === searchResult.id);
        if (route == null) {
            return false;
        }
        this.store.dispatch(new SetPublicRoutesSearchResultAction(null));
        this.moveToFeature(route);
        return true;
    }

    public async onStartPointClick(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>, event: MouseEvent) {
        event.stopPropagation();
        if (this.selectedRoutePoint()?.properties.poiId === feature.properties.poiId) {
            this.clearSelectedRoute();
            return;
        }
        ScrollToDirective.scrollTo(`route-${feature.properties.poiId}`, 60);
        this.moveToFeature(feature);
    }

    /** Unselects the route, its marker and its line on the map together, so neither outlives the other */
    public clearSelectedRoute() {
        this.selectedRoutePoint.set(null);
        this.selectedRouteGeoJson.set({
            type: "FeatureCollection",
            features: []
        });
        this.hoverFeature.set(null);
    }

    /**
     * Selects the route and draws its line once it is loaded, unless the route was unselected or another
     * one was selected meanwhile, which would leave a line on the map with no marker or sheet for it.
     */
    public async moveToFeature(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) {
        this.showMap.set(true);
        this.selectedRoutePoint.set(feature);
        this.isAtTrailHead.set(true);
        this.hoverFeature.set(null);
        const color = this.getRouteColor(feature);
        const fullFeature = await this.poiService.getBasicInfo(feature.properties.identifier, feature.properties.poiSource, this.resources.getCurrentLanguageCodeSimplified());
        if (this.selectedRoutePoint() !== feature) {
            return;
        }
        feature = this.moveToTrailHead(feature, fullFeature);
        this.selectedRouteGeoJson.set(this.createSelectedRouteGeoJson(fullFeature, color));
        if (feature.properties.poiSource === "OSM") {
            await this.poiService.updateExtendedInfo(fullFeature, this.resources.getCurrentLanguageCodeSimplified());
            if (this.selectedRoutePoint() !== feature) {
                return;
            }
            this.selectedRouteGeoJson.set(this.createSelectedRouteGeoJson(fullFeature, color));
        }
        const bounds = SpatialHelper.getBoundsForFeature(fullFeature);
        this.mapService.fitBounds(bounds, 100, { top: 100, left: 50, bottom: window.innerHeight / 2, right: 50 });
    }

    /**
     * Selects the route of a line clicked on the map. Its trail head can be out of view, and then the
     * route is not among the points of the tiles, so it is made of the line's attributes and its marker
     * waits for {@link moveToFeature} to load where the trail head is.
     */
    public onRouteLineClick(event: MapLayerMouseEvent) {
        const line = event.features[0];
        const trailHead = this.routesFromTiles.find(f => f.properties.poiId === line.properties.poiId);
        const route = trailHead ?? {
            type: "Feature",
            properties: {
                ...line.properties,
                identifier: this.poiService.osmTileFeatureToPoiIdentifier(line)
            } as PoiProperties,
            geometry: {
                type: "Point",
                coordinates: [event.lngLat.lng, event.lngLat.lat]
            }
        };
        this.onStartPointClick(route, event.originalEvent);
        if (trailHead == null) {
            this.isAtTrailHead.set(false);
        }
    }

    private getCategoryLinesFilter(category: CategoryType): FilterSpecification {
        return [...this.routeLinesFilter() as unknown[], ["==", ["get", "poiCategory"], category]] as FilterSpecification;
    }

    /** Puts the marker of the selected route where its full feature has the trail head, see {@link onRouteLineClick} */
    private moveToTrailHead(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>,
        fullFeature: GeoJSON.Feature): GeoJSON.Feature<GeoJSON.Point, PoiProperties> {
        const trailHead = fullFeature.properties.poiGeolocation as LatLngAltTime;
        if (trailHead == null) {
            return feature;
        }
        const moved: GeoJSON.Feature<GeoJSON.Point, PoiProperties> = {
            ...feature,
            geometry: { type: "Point", coordinates: [trailHead.lng, trailHead.lat] }
        };
        this.selectedRoutePoint.set(moved);
        this.isAtTrailHead.set(true);
        return moved;
    }

    /**
     * The color the tiles give the route's lines, read while they are in view, or the one of its tags
     * when the map draws none of them, as when the list was picked from while the map was hidden.
     */
    private getRouteColor(feature: GeoJSON.Feature<GeoJSON.Point, PoiProperties>): string {
        const lines = this.mapService.getFeaturesFromTiles(["==", ["get", "poiId"], feature.properties.poiId],
            [this.routeLinesLayer]);
        return lines[0]?.properties.color ?? GeoJSONUtils.getFeatureColor(feature) ?? PublicRoutesComponent.DEFAULT_ROUTE_COLOR;
    }

    /**
     * The route as {@link RoutesPathComponent} draws a planned one, in its color with a point at its start
     * and at its end. It is not made a route of, as a relation's lines are pieces that one route would join.
     */
    private createSelectedRouteGeoJson(fullFeature: GeoJSON.Feature, color: string): GeoJSON.FeatureCollection {
        const geometry = fullFeature.geometry;
        const lines = geometry.type === "LineString" ? [geometry.coordinates]
            : geometry.type === "MultiLineString" ? geometry.coordinates : [];
        const { weight, opacity } = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState);
        const features: GeoJSON.Feature[] = [{
            ...fullFeature,
            properties: {
                color,
                weight,
                opacity,
                iconColor: this.routesFactory.invertColorToBW(color),
                iconSize: weight < 10 ? 0.5 : 0.5 * weight / 10.0
            }
        }];
        if (lines.length > 0) {
            const lastLine = lines[lines.length - 1];
            features.push(
                { type: "Feature", properties: { color: START_COLOR, strokeColor: "white" }, geometry: { type: "Point", coordinates: lines[0][0] } },
                { type: "Feature", properties: { color: END_COLOR, strokeColor: "white" }, geometry: { type: "Point", coordinates: lastLine[lastLine.length - 1] } }
            );
        }
        return { type: "FeatureCollection", features };
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
        await this.mapService.flyTo(SpatialHelper.toLatLng(feature.geometry.coordinates as [number, number]), zoom);
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
        const bounds = SpatialHelper.getBoundsForFeature(fullFeature);
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