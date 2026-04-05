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
import { Angulartics2OnModule } from "application/directives/gtag.directive";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatSlider, MatSliderRangeThumb } from "@angular/material/slider";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { Share } from "@capacitor/share";
import { orderBy } from "lodash-es";
import type { StyleSpecification, Map, MapSourceDataEvent } from "maplibre-gl";

import { ImageAttributionComponent } from "../image-attribution.component";
import { ZoomComponent } from "../zoom.component";
import { OsmAttributionComponent } from "../osm-attribution.component";
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
import { GeoJSONUtils } from "../../services/geojson-utils";
import { PoiProperties } from "../../services/osm-tags.service";
import { RouteStrings } from "../../services/hash.service";
import { Urls } from "../../urls";
import type { ApplicationState } from "../../models";

@Component({
    selector: "public-routes",
    templateUrl: "./public-routes.component.html",
    styleUrls: ["./public-routes.component.scss"],
    imports: [Dir, MapComponent, LayersComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent, MatButton, FormsModule, MatButtonToggleGroup, MatButtonToggle, Angulartics2OnModule, NgClass, MatMenuTrigger, MatMenuItem, MatCheckbox, MatMenu, DistancePipe, GeoJSONSourceComponent, LayerComponent, MatSlider, MatSliderRangeThumb, CdkCopyToClipboard, ImageAttributionComponent, ZoomComponent, OsmAttributionComponent, ControlComponent]
})
export class PublicRoutesComponent {
    public mapStyle: StyleSpecification;
    public showMap: boolean = true;
    public readonly routesSrouceId = "routes-of-interest";
    public sortBy: string = "length";
    public sortDirection: "asc" | "desc" = "desc";
    public filterCategories: string[] = ["Bicycle", "Hiking", "4x4"];
    public filterDifficulty: string[] = ["Easy", "Moderate", "Hard", "Very Hard"];
    public filterLengthStart: number = 0;
    public filterLengthEnd: number = 50;
    public unitString: string = "km";

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

    constructor() {
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        const locationState = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.mapStyle.zoom = locationState.zoom;
        this.mapStyle.center = [locationState.longitude, locationState.latitude];
        this.store.select((state: ApplicationState) => state.locationState).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.runFilter();
        });
        this.store.select((state: ApplicationState) => state.configuration.units).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((units) => {
            this.unitString = this.resources.getLongDistanceUnitString(units);
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
        features = features.filter(f => f.properties.image != null);
        features = features.filter(feature => {
            const units = this.store.selectSnapshot((s: ApplicationState) => s.configuration).units;
            const factor = units === "metric" ? 1000.0 : 1609.344;
            if (!this.filterCategories.includes(feature.properties.poiCategory)) {
                return false;
            }
            if (feature.properties.poiDifficulty && !this.filterDifficulty.includes(feature.properties.poiDifficulty)) {
                return false;
            }
            if (feature.properties.poiLength / factor < this.filterLengthStart) {
                return false;
            }
            if (feature.properties.poiLength / factor > this.filterLengthEnd && this.filterLengthEnd < 50) {
                return false;
            }
            return true;
        });
        let sortBy: ((f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => string | number)[];
        switch (this.sortBy) {
            case "difficulty":
                sortBy = [(f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => f.properties.poiDifficulty];
                break;
            case "category":
                sortBy = [(f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => f.properties.poiCategory];
                break;
            case "length":
                sortBy = [(f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => f.properties.poiLength];
                break;
            case "name":
                sortBy = [(f: GeoJSON.Feature<GeoJSON.Point, PoiProperties>) => GeoJSONUtils.getTitle(f, this.resources.getCurrentLanguageCodeSimplified())];
                break;
        }


        features = orderBy(features, sortBy, [this.sortDirection]);
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
        this.mapService.fitBounds(bounds);
    }

    public getTitle(feature: GeoJSON.Feature<GeoJSON.Point>) {
        return GeoJSONUtils.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public getDescription(feature: GeoJSON.Feature<GeoJSON.Point>) {
        return GeoJSONUtils.getDescription(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hover(feature: GeoJSON.Feature<GeoJSON.Point>) {
        this.hoverFeature = feature;
    }

    public onSortChange() {
        this.runFilter();
    }

    public onFilterCategoryChange(value: string) {
        if (this.filterCategories.includes(value)) {
            this.filterCategories = this.filterCategories.filter((x) => x !== value);
        } else {
            this.filterCategories.push(value);
        }
        this.runFilter();
    }

    public onFilterDifficultyChange(value: string) {
        if (this.filterDifficulty.includes(value)) {
            this.filterDifficulty = this.filterDifficulty.filter((x) => x !== value);
        } else {
            this.filterDifficulty.push(value);
        }
        this.runFilter();
    }

    public onSortDirectionChange() {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
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

    public onFilterLengthStartChange(value: number) {
        this.filterLengthStart = value;
        this.runFilter();
    }

    public onFilterLengthEndChange(value: number) {
        this.filterLengthEnd = value;
        this.runFilter();
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