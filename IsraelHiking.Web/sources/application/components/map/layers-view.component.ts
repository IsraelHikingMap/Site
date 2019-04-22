import { Component, OnInit, AfterViewInit } from "@angular/core";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { select } from "@angular-redux/store";
import Supercluster from "supercluster";

import { PoiService, CategoriesType } from "../../services/poi.service";
import { LayersService } from "../../services/layers/layers.service";
import { CategoriesLayerFactory } from "../../services/layers/categories-layers.factory";
import { RouteStrings } from "../../services/hash.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState, Overlay, PointOfInterest, PointOfInterestExtended } from "../../models/models";

@Component({
    selector: "layers-view",
    templateUrl: "layers-view.component.html",
    styleUrls: ["layers-view.component.scss"]
})
export class LayersViewComponent extends BaseMapComponent implements OnInit, AfterViewInit {
    private static readonly MAX_MENU_POINTS_IN_CLUSTER = 7;

    public categoriesTypes: CategoriesType[];

    public poiGeoJsonData: { [category: string]: GeoJSON.FeatureCollection<GeoJSON.Point> };
    public superCluster: { [category: string]: Supercluster };

    public selectedPoiFeature: GeoJSON.Feature<GeoJSON.Point>;
    public selectedPoiGeoJson: GeoJSON.FeatureCollection;

    public selectedCluster: GeoJSON.Feature<GeoJSON.Point>;
    public clusterPoints: PointOfInterest[];

    public hoverFeature: GeoJSON.Feature<GeoJSON.Point>;

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.poiState.selectedPointOfInterest)
    public selectedPoi$: Observable<PointOfInterestExtended>;

    constructor(resources: ResourcesService,
        private readonly router: Router,
        private readonly layersService: LayersService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly poiService: PoiService) {
        super(resources);
        this.categoriesTypes = this.poiService.getCategoriesTypes();
        this.selectedCluster = null;
        this.hoverFeature = null;
        this.selectedPoiGeoJson = {
            type: "FeatureCollection",
            features: []
        };
        this.poiGeoJsonData = {};
        this.superCluster = {};
        for (let categoriesType of this.categoriesTypes) {
            this.poiGeoJsonData[categoriesType] = { type: "FeatureCollection", features: [] };
        }
    }

    public getBaseLayer() {
        return this.layersService.getSelectedBaseLayer();
    }

    public getBaseLayerAddress() {
        return this.layersService.getSelectedBaseLayerAddress();
    }

    public isVisible(categoriesType: CategoriesType) {
        return this.categoriesLayerFactory.get(categoriesType).isVisible();
    }

    ngOnInit() {
        for (let categoriesTypeIndex = 0; categoriesTypeIndex < this.categoriesTypes.length; categoriesTypeIndex++) {
            let categoriesType = this.categoriesTypes[categoriesTypeIndex];
            this.categoriesLayerFactory.get(categoriesType).markersLoaded.subscribe(() => {
                let features = this.categoriesLayerFactory.get(categoriesType).pointsOfInterest.map(p => this.poiToFeature(p));
                this.poiGeoJsonData[categoriesType] = {
                    type: "FeatureCollection",
                    features: features
                };
            });
        }
    }

    public ngAfterViewInit() {
        this.selectedPoi$.subscribe((poi) => this.onSelectedPoiChanged(poi));
    }

    private onSelectedPoiChanged = (poi: PointOfInterestExtended) => {
        if (poi == null) {
            this.selectedPoiFeature = null;
            this.selectedPoiGeoJson = {
                type: "FeatureCollection",
                features: []
            };
            return;
        }
        this.selectedPoiFeature = this.poiToFeature(poi);
        this.selectedPoiGeoJson = poi.featureCollection;
    }

    private poiToFeature(p: PointOfInterest): GeoJSON.Feature<GeoJSON.Point> {
        let id = p.source + "__" + p.id;
        return {
            type: "Feature",
            properties: {
                id: id,
                icon: p.icon,
                iconColor: p.iconColor,
                title: p.title,
                hasExtraData: p.hasExtraData
            },
            id: id,
            geometry: {
                type: "Point",
                coordinates: [p.location.lng, p.location.lat]
            }
        };
    }

    public openPoi(id) {
        this.selectedCluster = null;
        let sourceAndId = this.getSourceAndId(id);
        this.router.navigate([RouteStrings.ROUTE_POI, sourceAndId.source, sourceAndId.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }

    public toggleClusterPopup(event: MouseEvent, feature, categoriesType: CategoriesType) {
        event.stopPropagation();
        if (this.selectedCluster != null && feature.id === this.selectedCluster.id) {
            this.selectedCluster = null;
            this.clusterPoints = [];
            return;
        }
        let cluster = this.superCluster[categoriesType];
        let features = cluster.getLeaves(feature.properties.cluster_id, LayersViewComponent.MAX_MENU_POINTS_IN_CLUSTER);
        this.selectedCluster = feature;
        this.clusterPoints = features.map(f => {
            let properties = f.properties;
            let sourceAndId = this.getSourceAndId(f.id.toString());
            return {
                icon: properties.icon,
                iconColor: properties.iconColor,
                title: properties.title,
                id: sourceAndId.id,
                source: sourceAndId.source
            } as PointOfInterest;
        });
    }

    private getSourceAndId(sourceAndId: string): { source: string, id: string } {
        let poiSource = sourceAndId.split("__")[0];
        let id = sourceAndId.split("__")[1];
        return {
            source: poiSource,
            id: id
        };
    }

    public clearSelectedClusterPopup() {
        this.selectedCluster = null;
    }
}