import { Component, inject } from "@angular/core";
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogTitle } from "@angular/material/dialog";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { type Map, type MapMouseEvent, MercatorCoordinate, type StyleSpecification } from "maplibre-gl";
import { MatButton } from "@angular/material/button";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService } from "../../services/offline-files-download.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { TILES_ZOOM } from "../../services/pmtiles.service";
import { SpatialService } from "../../services/spatial.service";
import { DEFAULT_BASE_LAYERS, HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState, EditableLayer } from "../../models";

@Component({
    selector: "offline-management-dialog",
    templateUrl: "./offline-management-dialog.component.html",
    styleUrls: ["./offline-management-dialog.component.scss"],
    imports: [MapComponent, Angulartics2OnModule, MatDialogActions, MatDialogTitle, MatDialogClose, MatButton, LayerComponent, GeoJSONSourceComponent, AutomaticLayerPresentationComponent],
})
export class OfflineManagementDialogComponent {
    public offlineMapStyle: StyleSpecification;
    public selectedTile: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public inProgressTile: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public downloadedTiles: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public currentLocation: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public baseLayerData: EditableLayer;
    public selectedTileXY: { tileX: number; tileY: number } = null;

    private map: Map;

    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    public readonly resources = inject(ResourcesService);

    public static openDialog(matDialog: MatDialog) {
        return matDialog.open(OfflineManagementDialogComponent, {
            width: "100vw",
            height: "calc(100vh-env(safe-area-inset-bottom, 0)-env(safe-area-inset-top, 0))",
            maxWidth: "100vw",
        });
    }

    constructor() {
        this.offlineMapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        this.baseLayerData = this.layersService.getSelectedBaseLayer();
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
        this.updateDownloadedTiles();
        this.offlineFilesDownloadService.tilesProgressChanged.subscribe((tileProgress) => {
            if (this.downloadingTileXY()) {
                this.updateInProgressTile(tileProgress.progressValue);
            }
        });
    }

    private initializeCenterAndZoomFromDownloadingTile() {
        const dowloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.offlineState.downloadedTiles);
        if (!dowloadedTiles) {
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
        for (const key of Object.keys(dowloadedTiles)) {
            const [tileX, tileY] = key.split("-").map(Number);
            if (isNaN(tileX) || isNaN(tileY)) {
                continue;
            }
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
        const { tileX, tileY } = this.selectedTileXY;
        this.map.flyTo({
            center: SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM)),
            zoom: TILES_ZOOM - 1
        });
        this.selectedTileXY = null;
        this.updateDownloadedTiles();
        this.updateSelectedTile();
        const status = await this.offlineFilesDownloadService.downloadTile(tileX, tileY);
        switch (status) {
            case "up-to-date":
                this.toastService.success(this.resources.allFilesAreUpToDate);
                break;
            case "downloaded":
                this.toastService.success(this.resources.downloadFinishedSuccessfully);
                break;
            case "error":
                this.selectedTileXY = { tileX, tileY };
                this.toastService.warning(this.resources.unexpectedErrorPleaseTryAgainLater);
                break;
            case "aborted":
                this.selectedTileXY = { tileX, tileY };
                break;
        }

        // For some reason, sometime it gets to 100% and doesn't clear the download progress, this is a hack to prevent it...
        setTimeout(() => {
            this.updateInProgressTile(100);
            this.updateDownloadedTiles();
            this.updateSelectedTile();
        }, 3000)

    }


    private tileCoordinatesToPolygon(tileX: number, tileY: number, label: string = "", progress: number = 1): GeoJSON.Feature {
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
                        SpatialService.toCoordinate(SpatialService.fromTile({ x: tileX, y: tileY }, TILES_ZOOM)),
                    ],
                ],
            },
            properties: {
                label
            }
        }
    }

    private updateDownloadedTiles() {
        const features: GeoJSON.Feature[] = [];
        const downloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.offlineState.downloadedTiles);
        for (const key of Object.keys(downloadedTiles || {})) {
            const [tileXDownloaded, tileYDownloaded] = key.split("-").map(Number);
            if (isNaN(tileXDownloaded) || isNaN(tileYDownloaded)) {
                continue;
            }
            if (this.downloadingTileXY()?.tileX === tileXDownloaded && this.downloadingTileXY()?.tileY === tileYDownloaded) {
                continue; // Skip tiles that are in progress
            }
            const { tileX, tileY } = this.selectedTileXY || { tileX: null, tileY: null };
            if (this.downloadingTileXY() == null && tileXDownloaded === tileX && tileYDownloaded === tileY) {
                continue; // Skip the center tile if not downloading
            }

            const downloadedDate = this.offlineFilesDownloadService.getLastModifiedDate(downloadedTiles[key]);
            const label = downloadedDate.getFullYear() + "\n" +
                (downloadedDate.getMonth() + 1).toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), { minimumIntegerDigits: 2 }) + "\n" +
                downloadedDate.getDate().toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), { minimumIntegerDigits: 2 });
            const feature = this.tileCoordinatesToPolygon(tileXDownloaded, tileYDownloaded, label, 1);
            feature.properties.color = this.offlineFilesDownloadService.isTileCompatible(downloadedTiles[key]) ? "blue" : "red";
            features.push(feature);
        }

        this.downloadedTiles = {
            type: "FeatureCollection",
            features: features,
        };
    }

    private updateSelectedTile() {
        const { tileX, tileY } = this.selectedTileXY || { tileX: null, tileY: null };
        this.selectedTile = {
            type: "FeatureCollection",
            features: this.downloadingTileXY() != null || this.selectedTileXY == null ? [] : [this.tileCoordinatesToPolygon(tileX, tileY, this.resources.clickBelow)]
        };
    }

    private updateInProgressTile(progress: number) {
        if (this.downloadingTileXY() == null) {
            this.inProgressTile = { type: "FeatureCollection", features: [] };
            return;
        }
        const fillFeature = this.tileCoordinatesToPolygon(
            this.downloadingTileXY().tileX,
            this.downloadingTileXY().tileY,
            "",
            progress / 100.0,
        );
        fillFeature.properties.fill = "true";
        const strokeFeature = this.tileCoordinatesToPolygon(
            this.downloadingTileXY().tileX,
            this.downloadingTileXY().tileY,
            progress.toFixed(2) + "%"
        );
        strokeFeature.properties.stroke = "true";
        this.inProgressTile = {
            type: "FeatureCollection",
            features: [fillFeature, strokeFeature]
        };
    }

    public cancelDownload() {
        this.offlineFilesDownloadService.abortCurrentDownload();
        this.updateDownloadedTiles();
        this.updateInProgressTile(100);
        this.updateSelectedTile();
    }

    public onMapClick(event: MapMouseEvent) {
        const tileCount = Math.pow(2, TILES_ZOOM);
        const mercator = MercatorCoordinate.fromLngLat(event.lngLat);
        const tileX = Math.floor((mercator.x * tileCount));
        const tileY = Math.floor((mercator.y * tileCount));
        this.selectedTileXY = { tileX, tileY };
        this.updateSelectedTile();
        this.updateDownloadedTiles();
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

    public isSelectedAvailableForOffline(): boolean {
        if (!this.selectedTileXY) {
            return false;
        }
        const downloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.offlineState.downloadedTiles);
        return downloadedTiles != null && downloadedTiles[`${this.selectedTileXY.tileX}-${this.selectedTileXY.tileY}`] != null;
    }

    public async deleteSelected() {
        if (!this.selectedTileXY) {
            return;
        }
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: async () => {
                await this.offlineFilesDownloadService.deleteTile(this.selectedTileXY.tileX, this.selectedTileXY.tileY);
                this.selectedTileXY = null;
                this.updateSelectedTile();
                this.updateDownloadedTiles();
            }
        });
    }

    public downloadingTileXY() {
        return this.offlineFilesDownloadService.currentDownloadedTile;
    }
}