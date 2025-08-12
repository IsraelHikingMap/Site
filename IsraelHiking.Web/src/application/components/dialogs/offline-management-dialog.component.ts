import { Component, inject } from "@angular/core";
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogTitle } from "@angular/material/dialog";
import { NgIf } from "@angular/common";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { MapMouseEvent, MercatorCoordinate, LngLatLike, StyleSpecification } from "maplibre-gl";
import { MatButton } from "@angular/material/button";
import { Angulartics2OnModule } from "angulartics2";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService } from "../../services/offline-files-download.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { TILES_ZOOM } from "../../services/pmtiles.service";
import { SpatialService } from "../../services/spatial.service";
import { HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState, EditableLayer } from "../../models";

@Component({
    selector: "offline-management-dialog",
    templateUrl: "./offline-management-dialog.component.html",
    styleUrls: ["./offline-management-dialog.component.scss"],
    imports: [MapComponent, Angulartics2OnModule, MatDialogActions, MatDialogTitle, MatDialogClose, MatButton, LayerComponent, GeoJSONSourceComponent, NgIf, AutomaticLayerPresentationComponent],
})
export class OfflineManagementDialogComponent {
    public offlineMapStyle: StyleSpecification;
    public center: LngLatLike;
    public selectedTile: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public inProgressTile: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public downloadedTiles: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public baseLayerData: EditableLayer;
    public downloadingTileXY: {tileX: number; tileY: number} = null;
    public selectedTileXY: {tileX: number; tileY: number} = null;

    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    public readonly resources = inject(ResourcesService);

    public static openDialog(matDialog: MatDialog) {
        return matDialog.open(OfflineManagementDialogComponent, {
            width: "100vw",
            height: "100vh",
            maxWidth: "100vw",
        });
    }

    constructor() {
        const location = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        this.center = [location.longitude, location.latitude];
        this.offlineMapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        this.baseLayerData = this.layersService.getSelectedBaseLayer();
        if (this.baseLayerData.key !== HIKING_MAP && this.baseLayerData.key !== MTB_MAP) {
            this.baseLayerData = {...this.store.selectSnapshot((state: ApplicationState) => state.layersState.baseLayers).find((layer) => layer.key === HIKING_MAP)};
        }
        this.updateDownloadedTiles();
        this.offlineFilesDownloadService.tilesProgressChanged.subscribe((tileProgress) => {
            if (this.downloadingTileXY) {
                this.updateInProgressTile(tileProgress.progressValue);
            }
        });
    }

    public async downloadSelected() {
        const { tileX, tileY } = this.selectedTileXY;
        this.downloadingTileXY = { tileX, tileY };
        this.center = SpatialService.toCoordinate(SpatialService.fromTile({x: tileX + 0.5, y: tileY + 0.5}, TILES_ZOOM));
        this.updateDownloadedTiles();
        this.updateSelectedTile();
        const status = await this.offlineFilesDownloadService.downloadTile(tileX, tileY);
        switch (status) {
            case "up-to-date":
                this.selectedTileXY = null;
                this.toastService.success(this.resources.allFilesAreUpToDate + " " + this.resources.useTheCloudIconToGoOffline);
                break;
            case "downloaded":
                this.selectedTileXY = null;
                this.toastService.success(this.resources.downloadFinishedSuccessfully + " " + this.resources.useTheCloudIconToGoOffline);
                break;
            case "error":
                this.toastService.warning(this.resources.unexpectedErrorPleaseTryAgainLater);
                break;
            case "aborted":
                // No need to do anything
                break;
        }

        this.downloadingTileXY = null;
        this.updateInProgressTile(100);
        this.updateDownloadedTiles();
        this.updateSelectedTile();
    }


    private tileCoordinatesToPolygon(tileX: number, tileY: number, label: string = "", progress: number = 1): GeoJSON.Feature {
        return {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        SpatialService.toCoordinate(SpatialService.fromTile({x: tileX, y: tileY}, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({x: tileX + progress, y: tileY}, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({x: tileX + progress, y: tileY + 1}, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({x: tileX, y: tileY + 1}, TILES_ZOOM)),
                        SpatialService.toCoordinate(SpatialService.fromTile({x: tileX, y: tileY}, TILES_ZOOM)),
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
            if (this.downloadingTileXY && this.downloadingTileXY.tileX === tileXDownloaded && this.downloadingTileXY.tileY === tileYDownloaded) {
                continue; // Skip tiles that are in progress
            }
            const { tileX, tileY } = this.selectedTileXY || { tileX: null, tileY: null };
            if (this.downloadingTileXY == null && tileXDownloaded === tileX && tileYDownloaded === tileY) {
                continue; // Skip the center tile if not downloading
            }
            
            const downloadedDate = new Date(downloadedTiles[key]);
            const label = downloadedDate.getFullYear() + "\n" + 
                (downloadedDate.getMonth() + 1).toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), {minimumIntegerDigits: 2}) + "\n" + 
                downloadedDate.getDate().toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), {minimumIntegerDigits: 2});
            features.push(this.tileCoordinatesToPolygon(tileXDownloaded, tileYDownloaded, label, 1));
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
            features: this.downloadingTileXY != null || this.selectedTileXY == null ? [] : [this.tileCoordinatesToPolygon(tileX, tileY, this.resources.clickBelow)]
        };
    }

    private updateInProgressTile(progress: number) {
        if (this.downloadingTileXY == null) {
            this.inProgressTile = { type: "FeatureCollection", features: [] };
            return;
        }
        const fillFeature = this.tileCoordinatesToPolygon(
            this.downloadingTileXY.tileX,
            this.downloadingTileXY.tileY,
            "", 
            progress / 100.0,
        );
        fillFeature.properties.fill = "true";
        const strokeFeature = this.tileCoordinatesToPolygon(
            this.downloadingTileXY.tileX,
            this.downloadingTileXY.tileY,
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
        this.downloadingTileXY = null;
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
    }
}