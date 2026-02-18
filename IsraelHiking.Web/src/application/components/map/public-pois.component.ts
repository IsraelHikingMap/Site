import { Component, DestroyRef, inject, OnInit } from "@angular/core";

import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MatDialog } from "@angular/material/dialog";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Router } from "@angular/router";
import { GeoJSONSourceComponent, SourceDirective, MarkersForClustersComponent, PointDirective, ClusterPointDirective, PopupComponent, MarkerComponent, LayerComponent, VectorSourceComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Store } from "@ngxs/store";
import { v4 as uuidv4 } from "uuid";
import type { Immutable } from "immer";

import { CoordinatesComponent } from "../coordinates.component";
import { ClusterOverlayComponent } from "../overlays/cluster-overlay.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { PoiService } from "../../services/poi.service";
import { RouteStrings } from "../../services/hash.service";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { NavigateHereService } from "../../services/navigate-here.service";
import { SetSelectedPoiAction } from "../../reducers/poi.reducer";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import { GeoJSONUtils } from "../../services/geojson-utils";
import { Urls } from "../../urls";
import type { ApplicationState, LatLngAltTime, LinkData, MarkerData } from "../../models";
import { skip } from "rxjs";

@Component({
    selector: "public-pois",
    templateUrl: "public-pois.component.html",
    styleUrls: ["public-pois.component.scss"],
    imports: [SourceDirective, GeoJSONSourceComponent, MarkersForClustersComponent, PointDirective, Angulartics2OnModule, ClusterPointDirective, PopupComponent, ClusterOverlayComponent, Dir, MatButton, MatTooltip, CoordinatesComponent, MarkerComponent, LayerComponent, VectorSourceComponent]
})
export class PublicPoisComponent implements OnInit {
    private static readonly MAX_MENU_POINTS_IN_CLUSTER = 50;

    public poisVectorTileAddress = [Urls.baseTilesAddress.replace("https://", "slice://") + "/vector/data/global_points/{z}/{x}/{y}.mvt"];

    public poiGeoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public selectedPoiFeature: GeoJSON.Feature<GeoJSON.Point> = null;
    public selectedPoiGeoJson: Immutable<GeoJSON.FeatureCollection> = {
        type: "FeatureCollection",
        features: []
    };
    public selectedCluster: GeoJSON.Feature<GeoJSON.Point> = null;
    public clusterFeatures: GeoJSON.Feature<GeoJSON.Point>[];
    public hoverFeature: GeoJSON.Feature<GeoJSON.Point> = null;
    public isShowCoordinatesPopup: boolean = false;

    public readonly resources = inject(ResourcesService);

    private readonly router = inject(Router);
    private readonly matDialog = inject(MatDialog);
    private readonly poiService = inject(PoiService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly navigateHereService = inject(NavigateHereService);
    private readonly store = inject(Store);
    private readonly destroyRef = inject(DestroyRef);
    private readonly mapComponent = inject(MapComponent);

    public ngOnInit() {
        this.poiGeoJsonData = this.poiService.getPoisGeoJson();
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(takeUntilDestroyed(this.destroyRef), skip(1)).subscribe(() => {
            this.poiGeoJsonData = this.poiService.getPoisGeoJson();
        });
        this.store.select((state: ApplicationState) => state.layersState.visibleCategories).pipe(takeUntilDestroyed(this.destroyRef), skip(1)).subscribe(() => {
            this.poiGeoJsonData = this.poiService.getPoisGeoJson();
        });
        this.mapComponent.sourceData.subscribe((sourceData) => {
            if (sourceData.sourceId === PoiService.POIS_SOURCE_ID) {
                this.poiGeoJsonData = this.poiService.getPoisGeoJson();
            }
        });
        this.mapComponent.moveEnd.subscribe(() => {
            this.poiGeoJsonData = this.poiService.getPoisGeoJson();
        });

        this.store.select((state: ApplicationState) => state.poiState.selectedPointOfInterest).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(poi => this.onSelectedPoiChanged(poi));
    }

    private onSelectedPoiChanged(poi: Immutable<GeoJSON.Feature>) {
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
        const sourceAndId = this.getSourceAndId(this.poiService.getFeatureId(feature));
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
        const features = await sourceComponent.getClusterLeaves(feature.properties.cluster_id,
            PublicPoisComponent.MAX_MENU_POINTS_IN_CLUSTER, 0) as GeoJSON.Feature<GeoJSON.Point>[];
        const language = this.resources.getCurrentLanguageCodeSimplified();
        features.sort((a, b) => {
            if (GeoJSONUtils.hasExtraData(a, language) !== GeoJSONUtils.hasExtraData(b, language)) {
                return GeoJSONUtils.hasExtraData(a, language) ? -1 : 1;
            }
            return GeoJSONUtils.getTitle(a, language).localeCompare(GeoJSONUtils.getTitle(b, language));
        });
        this.clusterFeatures = features;
        this.selectedCluster = feature;
    }

    private getSourceAndId(sourceAndId: string): { source: string; id: string } {
        const poiSource = sourceAndId.split("_")[0];
        const id = sourceAndId.replace(poiSource + "_", "");
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
        return GeoJSONUtils.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hasExtraData(feature: GeoJSON.Feature<GeoJSON.Point>): boolean {
        return GeoJSONUtils.hasExtraData(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public isCoordinatesFeature(feature: Immutable<GeoJSON.Feature>) {
        if (!feature) {
            return false;
        }
        return feature.properties.poiSource === RouteStrings.COORDINATES;
    }

    public addCoordinatePointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        const markerData: MarkerData = {
            id: uuidv4(),
            latlng: this.getSelectedFeatureLatlng(),
            title: "",
            description: "",
            type: "star",
            urls: [] as LinkData[]
        };
        this.store.dispatch(new AddPrivatePoiAction(selectedRoute.id, markerData));
        this.clearSelected();
        selectedRoute = this.selectedRouteService.getSelectedRoute();
        const index = selectedRoute.markers.length - 1;
        PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, index, selectedRoute.id);
    }

    public clearSelected() {
        this.store.dispatch(new SetSelectedPoiAction(null));
        this.hoverFeature = null;
    }

    public getSelectedFeatureLatlng(): LatLngAltTime {
        return SpatialService.toLatLng(this.selectedPoiFeature.geometry.coordinates as [number, number]);
    }

    public navigateHere() {
        this.navigateHereService.addNavigationSegment(this.getSelectedFeatureLatlng());
        this.clearSelected();
    }
}
