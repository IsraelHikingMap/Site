import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { GeoJSONSourceComponent } from "ngx-maplibre-gl";

import { BaseMapComponent } from "../base-map.component";
import { PoiService } from "../../services/poi.service";
import { LayersService } from "../../services/layers/layers.service";
import { RouteStrings } from "../../services/hash.service";
import { ResourcesService } from "../../services/resources.service";
import { select, NgRedux } from "../../reducers/infra/ng-redux.module";
import { SetSelectedPoiAction } from "../../reducers/poi.reducer";
import { ApplicationState, Overlay } from "../../models/models";

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

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.poiState.selectedPointOfInterest)
    public selectedPoi$: Observable<GeoJSON.Feature>;

    constructor(resources: ResourcesService,
                private readonly router: Router,
                private readonly layersService: LayersService,
                private readonly poiService: PoiService,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.selectedCluster = null;
        this.hoverFeature = null;
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
    }

    public openPoi(id: string, e: Event) {
        e.stopPropagation();
        this.selectedCluster = null;
        let sourceAndId = this.getSourceAndId(id);
        if (sourceAndId.source === "Coordinates" && this.ngRedux.getState().poiState.selectedPointOfInterest.id === sourceAndId.id) {
            this.ngRedux.dispatch(new SetSelectedPoiAction({ poi: null }));
            this.hoverFeature = null;
            return;
        }
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
}
