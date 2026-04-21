import { Component, DestroyRef, inject } from "@angular/core";
import { Router } from "@angular/router";
import { NgClass } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { GeoJSONSourceComponent, MapComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent, ControlComponent } from "@maplibre/ngx-maplibre-gl";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";
import { MatButton } from "@angular/material/button";
import { FormsModule } from "@angular/forms";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { AnalyticsDirective } from "application/directives/analytics.directive";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { Share } from "@capacitor/share";
import { orderBy } from "lodash-es";
import type { StyleSpecification, Map, MapSourceDataEvent } from "maplibre-gl";

import { ImageAttributionComponent } from "../image-attribution.component";
import { ZoomComponent } from "../zoom.component";
import { OsmAttributionComponent } from "../osm-attribution.component";
import { PublicRoutesFilterComponent } from "../public-routes-filter.component";
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
import { ImageAttributionService } from "../../services/image-attribution.service";
import { GeoJSONUtils } from "../../services/geojson-utils";
import { PoiProperties } from "../../services/osm-tags.service";
import { RouteStrings } from "../../services/hash.service";
import { Urls } from "../../urls";
import type { ApplicationState } from "../../models";

@Component({
    selector: "public-routes",
    templateUrl: "./public-routes.component.html",
    styleUrls: ["./public-routes.component.scss"],
    imports: [Dir, MapComponent, LayersComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent, MatButton, FormsModule, MatButtonToggleGroup, MatButtonToggle, AnalyticsDirective, NgClass, MatMenuTrigger, MatMenuItem, MatMenu, DistancePipe, GeoJSONSourceComponent, LayerComponent, CdkCopyToClipboard, ImageAttributionComponent, ZoomComponent, OsmAttributionComponent, ControlComponent, PublicRoutesFilterComponent]
})
export class PublicRoutesComponent {
    public mapStyle: StyleSpecification;
    public showMap: boolean = true;
    public readonly routesSrouceId = "routes-of-interest";


    public poisVectorTileAddress = [Urls.baseTilesAddress.replace("https://", "slice://") + "/vector/data/global_points/{z}/{x}/{y}.mvt"];
    public poiGeoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: "FeatureCollection",
        features: []
    };
    public hoverFeature: GeoJSON.Feature<GeoJSON.Point> = null;
    public selectedRouteGeoJson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: []
    };
    public selectedRoutePoint: GeoJSON.Feature<GeoJSON.Point> = null;

    public readonly resources = inject(ResourcesService);

    private readonly mapService = inject(MapService);
    private readonly poiService = inject(PoiService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly store = inject(Store);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly router = inject(Router);
    private readonly runningContextSerivce = inject(RunningContextService);
    private readonly imageAttributionService = inject(ImageAttributionService);

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
        let features = this.poiService.getPublicRoutes(["Hiking", "Bicycle", "4x4"]).features;
        const filters = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter);
        features = features.filter(f => f.properties.image != null);
        features = features.filter(feature => {
            const units = this.store.selectSnapshot((s: ApplicationState) => s.configuration).units;
            const factor = units === "metric" ? 1000.0 : 1609.344;
            if (!filters.categories.includes(feature.properties.poiCategory)) {
                return false;
            }
            if (feature.properties.poiDifficulty && !filters.difficulty.includes(feature.properties.poiDifficulty)) {
                return false;
            }
            if (feature.properties.poiLength / factor < filters.lengthRange[0]) {
                return false;
            }
            if (feature.properties.poiLength / factor > filters.lengthRange[1] && filters.lengthRange[1] < 50) {
                return false;
            }
            if (filters.userId && feature.properties.poiUserId !== filters.userId) {
                return false;
            }
            return true;
        });
        const sortBy = [(f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => f.properties.poiLength];



        features = orderBy(features, sortBy, ["desc"]);
        this.poiGeoJsonData = {
            type: "FeatureCollection",
            features
        }
    }

    public async onStartPointClick(feature: GeoJSON.Feature<GeoJSON.Point>, event: MouseEvent) {
        event.stopPropagation();
        if (this.selectedRoutePoint?.properties.poiId === feature.properties.poiId) {
            this.selectedRoutePoint = null;
            this.selectedRouteGeoJson = {
                type: "FeatureCollection",
                features: []
            };
            this.hoverFeature = null;
            return;
        }
        ScrollToDirective.scrollTo(`route-${feature.properties.poiId}`, 60);
        this.moveToFeature(feature);
    }

    public async moveToFeature(feature: GeoJSON.Feature<GeoJSON.Point>) {
        this.showMap = true;
        this.selectedRoutePoint = feature;
        this.hoverFeature = null;
        const fullFeature = await this.poiService.getBasicInfo(feature.properties.identifier, feature.properties.poiSource, this.resources.getCurrentLanguageCodeSimplified());
        this.selectedRouteGeoJson = {
            type: "FeatureCollection",
            features: [fullFeature]
        };
        if (feature.properties.poiSource === "OSM") {
            await this.poiService.updateExtendedInfo(fullFeature, this.resources.getCurrentLanguageCodeSimplified());
            this.selectedRouteGeoJson = {
                type: "FeatureCollection",
                features: [fullFeature]
            };
        }
        const bounds = SpatialService.getBoundsForFeature(fullFeature);
        this.mapService.fitBounds(bounds, 100, { top: 100, left: 50, bottom: window.innerHeight / 2, right: 50 });
    }

    public getTitle(feature: GeoJSON.Feature<GeoJSON.Point>) {
        return GeoJSONUtils.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public getDescription(feature: GeoJSON.Feature<GeoJSON.Point>) {
        // HM TODO: add translation support here as well
        return GeoJSONUtils.getDescription(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hover(feature: GeoJSON.Feature<GeoJSON.Point>) {
        this.hoverFeature = feature;
    }

    public onSortChange() {
        this.runFilter();
    }


    public getIconFromType(feature: GeoJSON.Feature<GeoJSON.Point>) {
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
        this.selectedRouteService.convertToRoute(fullFeature, this.getDescription(feature));
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
}