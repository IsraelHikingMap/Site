import { Component, inject, signal, computed } from "@angular/core";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { type Map, type MapMouseEvent, MercatorCoordinate, type StyleSpecification } from "maplibre-gl";
import { MatButton } from "@angular/material/button";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService } from "../../services/offline-files-download.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { PmTilesService, TILES_ZOOM } from "../../services/pmtiles.service";
import { SpatialService } from "../../services/spatial.service";
import { DEFAULT_BASE_LAYERS, HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState, EditableLayer } from "../../models";

@Component({
    selector: "offline-management",
    templateUrl: "./offline-management.component.html",
    imports: [MapComponent, AnalyticsDirective, MatButton, LayerComponent, GeoJSONSourceComponent, AutomaticLayerPresentationComponent]
})
export class OfflineManagementComponent {
    public readonly offlineMapStyle: StyleSpecification;
    public readonly currentLocation: GeoJSON.FeatureCollection;
    public readonly baseLayerData: EditableLayer;
    public readonly selectedTileXY = signal<{ tileX: number; tileY: number }>(null);

    private map: Map;

    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    private readonly downloadedTilesState = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.downloadedTiles);
    public readonly resources = inject(ResourcesService);

    /** The tile that is being downloaded right now and how far it got, null when there is no download */
    public readonly downloadingTile = this.offlineFilesDownloadService.currentDownloadedTile;

    public readonly isSelectedAvailableForOffline = computed(() => {
        if (!this.selectedTileXY()) {
            return false;
        }
        const downloadedTiles = this.downloadedTilesState();
        return downloadedTiles[PmTilesService.toTileKey(this.selectedTileXY().tileX, this.selectedTileXY().tileY)] != null;
    });

    /**
     * The tiles that were downloaded, drawn from the files that are on the device - they are read into
     * the state while the app is running, so this follows it instead of being built once.
     * The tile that is being downloaded and the selected one are drawn on their own, so they are skipped.
     */
    public readonly downloadedTiles = computed<GeoJSON.FeatureCollection>(() => {
        const features: GeoJSON.Feature[] = [];
        const downloadedTiles = this.downloadedTilesState();
        for (const tileKey of Object.keys(downloadedTiles)) {
            const downloadedTile = PmTilesService.fromTileKey(tileKey);
            if (downloadedTile == null) {
                continue;
            }
            const { tileX: tileXDownloaded, tileY: tileYDownloaded } = downloadedTile;
            if (this.downloadingTile()?.tileX === tileXDownloaded && this.downloadingTile()?.tileY === tileYDownloaded) {
                continue; // Skip tiles that are in progress
            }
            const { tileX, tileY } = this.selectedTileXY() || { tileX: null, tileY: null };
            if (this.downloadingTile() == null && tileXDownloaded === tileX && tileYDownloaded === tileY) {
                continue; // Skip the center tile if not downloading
            }

            const downloadedDate = this.offlineFilesDownloadService.getLastModifiedDate(downloadedTiles[tileKey]);
            const label = downloadedDate.getFullYear() + "\n" +
                (downloadedDate.getMonth() + 1).toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), { minimumIntegerDigits: 2 }) + "\n" +
                downloadedDate.getDate().toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), { minimumIntegerDigits: 2 });
            const feature = this.tileCoordinatesToPolygon(tileXDownloaded, tileYDownloaded, label, 1);
            feature.properties.color = this.offlineFilesDownloadService.isTileCompatible(tileKey, downloadedTiles[tileKey]) ? "blue" : "red";
            features.push(feature);
        }

        return { type: "FeatureCollection", features };
    });

    /** The tile the user selected, it is not drawn while a tile is being downloaded */
    public readonly selectedTile = computed<GeoJSON.FeatureCollection>(() => {
        const selectedTileXY = this.selectedTileXY();
        const features = selectedTileXY == null || this.downloadingTile() != null
            ? []
            : [this.tileCoordinatesToPolygon(selectedTileXY.tileX, selectedTileXY.tileY, this.resources.clickBelow)];
        return { type: "FeatureCollection", features };
    });

    /** The tile that is being downloaded, filled up to the progress of its download */
    public readonly inProgressTile = computed<GeoJSON.FeatureCollection>(() => {
        const downloadingTile = this.downloadingTile();
        if (downloadingTile == null) {
            return { type: "FeatureCollection", features: [] };
        }
        const { tileX, tileY, progress } = downloadingTile;
        const fillFeature = this.tileCoordinatesToPolygon(tileX, tileY, "", progress / 100.0);
        fillFeature.properties.fill = "true";
        const strokeFeature = this.tileCoordinatesToPolygon(tileX, tileY, progress.toFixed(2) + "%");
        strokeFeature.properties.stroke = "true";
        return { type: "FeatureCollection", features: [fillFeature, strokeFeature] };
    });

    constructor() {
        this.offlineMapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        this.baseLayerData = this.layersService.selectedBaseLayer();
        if (this.baseLayerData.key !== HIKING_MAP && this.baseLayerData.key !== MTB_MAP) {
            this.baseLayerData = { ...DEFAULT_BASE_LAYERS[0] };
        }
        const stateLocation = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.currentLocation = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Point",
                    coordinates: [stateLocation.longitude, stateLocation.latitude]
                }
            }]
        }
    }

    private initializeCenterAndZoomFromDownloadingTile() {
        const dowloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState.downloadedTiles);
        if (Object.keys(dowloadedTiles).length === 0) {
            const mapCenter = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
            this.map.flyTo({
                center: [mapCenter.longitude, mapCenter.latitude],
                zoom: TILES_ZOOM
            });
            return;
        }

        let minTileX = Number.MAX_SAFE_INTEGER;
        let maxTileX = Number.MIN_SAFE_INTEGER;
        let minTileY = Number.MAX_SAFE_INTEGER;
        let maxTileY = Number.MIN_SAFE_INTEGER;
        for (const toTileKey of Object.keys(dowloadedTiles)) {
            const tile = PmTilesService.fromTileKey(toTileKey);
            if (tile == null) {
                continue;
            }
            const { tileX, tileY } = tile;
            minTileX = Math.min(minTileX, tileX);
            maxTileX = Math.max(maxTileX, tileX);
            minTileY = Math.min(minTileY, tileY);
            maxTileY = Math.max(maxTileY, tileY);
        }
        this.map.flyTo({
            center: SpatialService.toCoordinate(SpatialService.fromTile({ x: (minTileX + maxTileX + 1) / 2, y: (minTileY + maxTileY + 1) / 2 }, TILES_ZOOM)),
            zoom: Math.max(1, TILES_ZOOM - Math.log2(Math.max(maxTileX - minTileX + 1, maxTileY - minTileY + 1)) - 1)
        });
    }

    public async downloadSelected() {
        this.toastService.info(this.resources.dontSwitchApps);
        const { tileX, tileY } = this.selectedTileXY();
        this.map.flyTo({
            center: SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM)),
            zoom: TILES_ZOOM - 1
        });
        this.selectedTileXY.set(null);
        const status = await this.offlineFilesDownloadService.downloadTile(tileX, tileY);
        switch (status) {
            case "up-to-date":
                this.toastService.success(this.resources.allFilesAreUpToDate);
                break;
            case "downloaded":
                this.toastService.success(this.resources.downloadFinishedSuccessfully);
                break;
            case "error":
                this.selectedTileXY.set({ tileX, tileY });
                this.toastService.warning(this.resources.unexpectedErrorPleaseTryAgainLater);
                break;
            case "aborted":
                this.selectedTileXY.set({ tileX, tileY });
                break;
        }
    }


    private tileCoordinatesToPolygon(tileX: number, tileY: number, label = "", progress = 1): GeoJSON.Feature {
        return {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX, y: tileY }, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX + progress, y: tileY }, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX + progress, y: tileY + 1 }, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX, y: tileY + 1 }, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX, y: tileY }, TILES_ZOOM))
                    ]
                ]
            },
            properties: {
                label
            }
        }
    }



    public cancelDownload() {
        this.offlineFilesDownloadService.abortCurrentDownload();
    }

    public onMapClick(event: MapMouseEvent) {
        const tileCount = Math.pow(2, TILES_ZOOM);
        const mercator = MercatorCoordinate.fromLngLat(event.lngLat);
        const tileX = Math.floor((mercator.x * tileCount));
        const tileY = Math.floor((mercator.y * tileCount));
        this.selectedTileXY.set({ tileX, tileY });
        this.map.flyTo({
            center: SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM)),
            zoom: TILES_ZOOM - 1
        });
    }

    public onMapLoad(map: Map) {
        this.map = map;
        this.map.dragRotate.disable();
        this.map.touchZoomRotate.disableRotation();
        this.initializeCenterAndZoomFromDownloadingTile();
    }

    public async deleteSelected() {
        if (!this.selectedTileXY()) {
            return;
        }
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: async () => {
                await this.offlineFilesDownloadService.deleteTile(PmTilesService.toTileKey(this.selectedTileXY().tileX, this.selectedTileXY().tileY));
                this.selectedTileXY.set(null);
            }
        });
    }
}