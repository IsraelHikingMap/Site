import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { GeoJSONSourceComponent } from "@maplibre/ngx-maplibre-gl";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { PoiService } from "../../services/poi.service";
import { LayersService } from "../../services/layers.service";
import { RouteStrings } from "../../services/hash.service";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { SetSelectedPoiAction } from "../../reducers/poi.reducer";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import type { ApplicationState, LatLngAlt, LinkData, Overlay } from "../../models/models";

@Component({
    selector: "layers-view",
    templateUrl: "layers-view.component.html",
    styleUrls: ["layers-view.component.scss"]
})
export class LayersViewComponent extends BaseMapComponent implements OnInit {
    private static readonly MAX_MENU_POINTS_IN_CLUSTER = 7;

    public poiGeoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public selectedPoiFeature: GeoJSON.Feature<GeoJSON.Point>;
    public selectedPoiGeoJson: GeoJSON.FeatureCollection;
    public selectedCluster: GeoJSON.Feature<GeoJSON.Point>;
    public clusterFeatures: GeoJSON.Feature<GeoJSON.Point>[];
    public hoverFeature: GeoJSON.Feature<GeoJSON.Point>;
    public isShowCoordinatesPopup: boolean;

    @Select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @Select((state: ApplicationState) => state.poiState.selectedPointOfInterest)
    public selectedPoi$: Observable<GeoJSON.Feature>;

    constructor(resources: ResourcesService,
                private readonly router: Router,
                private readonly layersService: LayersService,
                private readonly poiService: PoiService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly store: Store
    ) {
        super(resources);
        this.selectedCluster = null;
        this.hoverFeature = null;
        this.isShowCoordinatesPopup = false;
        this.selectedPoiFeature = null;
        this.selectedPoiGeoJson = {
            type: "FeatureCollection",
            features: []
        };
    }

    public getBaseLayer() {
        return this.layersService.getSelectedBaseLayer();
    }

    public ngOnInit() {
        this.poiGeoJsonData = this.poiService.poiGeojsonFiltered;
        this.poiService.poisChanged.subscribe(() => {
            this.poiGeoJsonData = this.poiService.poiGeojsonFiltered;
        });
        this.selectedPoi$.subscribe((poi) => this.onSelectedPoiChanged(poi));
    }

    private onSelectedPoiChanged(poi: GeoJSON.Feature) {
        this.selectedPoiFeature = !poi ? null : {
            type: "Feature",
            properties: poi.properties,
            geometry: {
                type: "Point",
                coordinates: [poi.properties.poiGeolocation.lon, poi.properties.poiGeolocation.lat]
            }
        };
        this.selectedPoiGeoJson = {
            type: "FeatureCollection",
            features: poi == null ? [] : [poi]
        };
        if (this.isCoordinatesFeature(poi)) {
            this.isShowCoordinatesPopup = true;
        }
    }

    public openPoi(feature: GeoJSON.Feature<GeoJSON.Point>, e: Event) {
        e.stopPropagation();
        this.selectedCluster = null;
        this.hoverFeature = null;
        if (this.isCoordinatesFeature(feature)) {
            this.isShowCoordinatesPopup = !this.isShowCoordinatesPopup;
            return;
        }
        let sourceAndId = this.getSourceAndId(this.poiService.getFeatureId(feature));
        this.router.navigate([RouteStrings.ROUTE_POI, sourceAndId.source, sourceAndId.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });

    }

    public async toggleClusterPopup(event: MouseEvent, feature: GeoJSON.Feature<GeoJSON.Point>, sourceComponent: GeoJSONSourceComponent) {
        event.stopPropagation();
        if (this.selectedCluster != null && feature.properties.id === this.selectedCluster.properties.id) {
            this.selectedCluster = null;
            this.clusterFeatures = [];
            return;
        }
        this.clusterFeatures = await sourceComponent.getClusterLeaves(feature.properties.cluster_id,
            LayersViewComponent.MAX_MENU_POINTS_IN_CLUSTER, 0) as GeoJSON.Feature<GeoJSON.Point>[];
        this.selectedCluster = feature;
    }

    private getSourceAndId(sourceAndId: string): { source: string; id: string } {
        let poiSource = sourceAndId.split("_")[0];
        let id = sourceAndId.replace(poiSource + "_", "");
        return {
            source: poiSource,
            id
        };
    }

    public clearSelectedClusterPopup() {
        this.selectedCluster = null;
    }

    public setHoverFeature(selectedPoi: GeoJSON.Feature<GeoJSON.Point>) {
        if (this.getTitle(selectedPoi)) {
            this.hoverFeature = selectedPoi;
        }
    }

    public getTitle(feature: GeoJSON.Feature<GeoJSON.Point>): string {
        return this.poiService.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hasExtraData(feature: GeoJSON.Feature<GeoJSON.Point>): boolean {
        return this.poiService.hasExtraData(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public isCoordinatesFeature(feature: GeoJSON.Feature) {
        if (!feature) {
            return false;
        }
        return feature.properties.poiSource === RouteStrings.COORDINATES;
    }

    public trackByKey(_: number, el: Overlay) {
        return el.key;
    }

    public addPointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        let markerData = {
            latlng: this.getSelectedFeatureLatlng(),
            title: "",
            description: "",
            type: "star",
            urls: [] as LinkData[]
        };
        this.store.dispatch(new AddPrivatePoiAction(selectedRoute.id, markerData));
        this.clearSelected();
    }

    public clearSelected() {
        this.store.dispatch(new SetSelectedPoiAction(null));
        this.hoverFeature = null;
    }

    public getSelectedFeatureLatlng(): LatLngAlt {
        return SpatialService.toLatLng(this.selectedPoiFeature.geometry.coordinates as [number, number]);
    }
}
