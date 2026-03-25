import { Component, DestroyRef, inject } from "@angular/core";
import { NgClass } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { GeoJSONSourceComponent, MapComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent } from "@maplibre/ngx-maplibre-gl";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Store } from "@ngxs/store";
import { MatButton } from "@angular/material/button";
import { FormsModule } from "@angular/forms";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { Angulartics2OnModule } from "application/directives/gtag.directive";
import { MatFormField, MatLabel } from "@angular/material/input";
import { MatOption, MatSelect } from "@angular/material/select";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatCheckbox } from "@angular/material/checkbox";
import { Router } from "@angular/router";
import { orderBy } from "lodash-es";
import type { StyleSpecification, Map } from "maplibre-gl";
import type { Immutable } from "immer";

import { Urls } from "../../urls";
import { DistancePipe } from "../../pipes/distance.pipe";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersComponent } from "../map/layers.component";
import { MapService } from "../../services/map.service";
import { ResourcesService } from "../../services/resources.service";
import { PoiService } from "../../services/poi.service";
import { SpatialService } from "../../services/spatial.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { GeoJSONUtils } from "../../services/geojson-utils";
import { PoiProperties } from "../../services/osm-tags.service";
import { RouteStrings } from "../../services/hash.service";
import type { ApplicationState } from "../../models";

@Component({
    selector: "public-routes",
    templateUrl: "./public-routes.component.html",
    styleUrls: ["./public-routes.component.scss"],
    imports: [Dir, MapComponent, LayersComponent, VectorSourceComponent, LayerComponent, PopupComponent, MarkerComponent, MatButton, FormsModule, MatButtonToggleGroup, MatButtonToggle, Angulartics2OnModule, NgClass, MatFormField, MatSelect, MatMenuTrigger, MatMenuItem, MatCheckbox, MatLabel, MatMenu, MatOption, DistancePipe, GeoJSONSourceComponent, LayerComponent]
})
export class PublicRoutesComponent {
    public mapStyle: StyleSpecification;
    public showMap: boolean = true;
    public sortBy: string = "length";
    public sortDirection: "asc" | "desc" = "desc";
    public filter: Partial<Record<keyof PoiProperties, string[]>> = {
        poiCategory: ["Biking", "Hiking", "4x4"]
    };

    public poisVectorTileAddress = [Urls.baseTilesAddress.replace("https://", "slice://") + "/vector/data/global_points/{z}/{x}/{y}.mvt"];
    public poiGeoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: "FeatureCollection",
        features: []
    };
    public hoverFeature: GeoJSON.Feature<GeoJSON.Point> = null;
    public selectedRouteGeoJson: Immutable<GeoJSON.FeatureCollection> = {
        type: "FeatureCollection",
        features: []
    };

    public readonly resources = inject(ResourcesService);

    private readonly mapService = inject(MapService);
    private readonly poiService = inject(PoiService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly store = inject(Store);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly router = inject(Router);

    constructor() {
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        const locationState = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.mapStyle.zoom = locationState.zoom;
        this.mapStyle.center = [locationState.longitude, locationState.latitude];
        this.store.select((state: ApplicationState) => state.locationState).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.runFilter();
        });
    }

    public mapLoaded(map: Map) {
        this.mapService.setMap(map);
        this.mapService.addArrowToMap(map);
        this.runFilter();
    }

    private runFilter() {
        let features = this.poiService.getPublicRoutes(["Hiking", "Bicycle", "4x4"]).features;
        features = features.filter(f => f.properties.image != null);
        features = features.filter(feature => {
            for (const key in this.filter) {
                const filterKey = key as keyof PoiProperties;
                const propValue = feature.properties[filterKey];
                if (this.filter[filterKey] && !this.filter[filterKey].includes(propValue as any)) {
                    return false;
                }
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
        ScrollToDirective.scrollTo(`route-${feature.properties.poiId}`, 60);
        this.moveToFeature(feature);
    }

    public async moveToFeature(feature: GeoJSON.Feature<GeoJSON.Point>) {
        this.showMap = true;
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

    public onFilterChange(key: keyof PoiProperties, value: string) {
        if (this.filter[key].includes(value)) {
            this.filter[key] = this.filter[key].filter((x) => x !== value);
        } else {
            this.filter[key].push(value);
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
}