import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Observable } from "rxjs";
import { GeoJSONSourceComponent } from "ngx-mapbox-gl";
import { select } from "@angular-redux/store";

import { PoiService } from "../../services/poi.service";
import { LayersService } from "../../services/layers/layers.service";
import { RouteStrings } from "../../services/hash.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { ApplicationState, Overlay, PointOfInterest, PointOfInterestExtended } from "../../models/models";

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
    public clusterPoints: PointOfInterest[];
    public hoverFeature: GeoJSON.Feature<GeoJSON.Point>;

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.poiState.selectedPointOfInterest)
    public selectedPoi$: Observable<PointOfInterestExtended>;

    constructor(resources: ResourcesService,
                private readonly router: Router,
                private readonly layersService: LayersService,
                private readonly poiService: PoiService
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

    private onSelectedPoiChanged = (poi: PointOfInterestExtended) => {
        if (poi == null) {
            this.selectedPoiFeature = null;
            this.selectedPoiGeoJson = {
                type: "FeatureCollection",
                features: []
            };
            return;
        }
        this.selectedPoiFeature = this.poiService.pointToFeature(poi);
        this.selectedPoiGeoJson = poi.featureCollection;
    }

    public openPoi(id, e: Event) {
        e.stopPropagation();
        this.selectedCluster = null;
        let sourceAndId = this.getSourceAndId(id);
        this.router.navigate([RouteStrings.ROUTE_POI, sourceAndId.source, sourceAndId.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });

    }

    public async toggleClusterPopup(event: MouseEvent, feature, sourceComponent: GeoJSONSourceComponent) {
        event.stopPropagation();
        if (this.selectedCluster != null && feature.properties.id === this.selectedCluster.properties.id) {
            this.selectedCluster = null;
            this.clusterPoints = [];
            return;
        }
        let features = await sourceComponent.getClusterLeaves(feature.properties.cluster_id,
            LayersViewComponent.MAX_MENU_POINTS_IN_CLUSTER, 0);
        this.selectedCluster = feature;
        this.clusterPoints = features.map(f => {
            let properties = f.properties;
            let sourceAndId = this.getSourceAndId(f.properties.poiId);
            return {
                icon: properties.poiIcon,
                iconColor: properties.poiIconColor,
                title: properties.title,
                id: sourceAndId.id,
                source: sourceAndId.source
            } as PointOfInterest;
        });
    }

    private getSourceAndId(sourceAndId: string): { source: string, id: string } {
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
        if (selectedPoi.properties.title) {
            this.hoverFeature = selectedPoi;
        }
    }
}
