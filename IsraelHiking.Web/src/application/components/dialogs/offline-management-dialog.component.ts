import { Component, inject } from "@angular/core";
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogTitle } from "@angular/material/dialog";
import { NgIf } from "@angular/common";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { MapMouseEvent, MercatorCoordinate, LngLatLike, StyleSpecification } from "maplibre-gl";
import { MatButton } from "@angular/material/button";
import { Angulartics2OnModule } from "angulartics2";

import { Urls } from "../../urls";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService } from "../../services/offline-files-download.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { TILES_ZOOM } from "../../services/database.service";
import type { ApplicationState, EditableLayer } from "../../models/models";

@Component({
    selector: "offline-management-dialog",
    templateUrl: "./offline-management-dialog.component.html",
    styleUrls: ["./offline-management-dialog.component.scss"],
    imports: [MapComponent, Angulartics2OnModule, MatDialogActions, MatDialogTitle, MatDialogClose, MatButton, LayerComponent, GeoJSONSourceComponent, NgIf],
})
export class OfflineManagementDialogComponent {
    public offlineMapStyle: StyleSpecification;
    public initialCenter: LngLatLike;
    public selectedTile: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public inProgressTile: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public downloadedTiles: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };
    public baseLayerData: EditableLayer;
    public downloadingTile: {tileX: number; tileY: number} = null;

    private center: LngLatLike;

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
        this.initialCenter = this.center;
        this.offlineMapStyle = this.defaultStyleService.style;
        // HM TODO: remove this? - there's a need to solve language problem here
        this.offlineMapStyle = Urls.HIKING_TILES_ADDRESS as any;
        this.baseLayerData = this.layersService.getSelectedBaseLayer();
        this.updateDownloadedTiles();
        this.updateSelectedTile();
        this.offlineFilesDownloadService.tilesProgressChanged.subscribe((tileProgress) => {
            if (this.downloadingTile) {
                this.updateInProgressTile(tileProgress.progressValue);
            }
        });
    }

    public async downloadCenter() {
        const { tileX, tileY } = this.getCenterTileXY();
        this.downloadingTile = { tileX, tileY };
        this.updateDownloadedTiles();
        this.updateSelectedTile();
        const status = await this.offlineFilesDownloadService.downloadTile(tileX, tileY);
        switch (status) {
            case "up-to-date":
                this.toastService.success(this.resources.allFilesAreUpToDate + " " + this.resources.useTheCloudIconToGoOffline);
                break;
            case "downloaded":
                this.toastService.success(this.resources.downloadFinishedSuccessfully + " " + this.resources.useTheCloudIconToGoOffline);
                break;
            case "error":
                // HM TODO: i18n
                this.toastService.warning("הייתה בעיה בהורדה, אנא נסו שוב");
                break;
        }

        this.downloadingTile = null;
        this.updateInProgressTile(100);
        this.updateDownloadedTiles();
        this.updateSelectedTile();
    }

    public onMoveEnd(event: MapMouseEvent) {
        this.center = event.target.getCenter();
        this.updateSelectedTile();
        this.updateDownloadedTiles();
    }

    private lngLatFromTileCoords(x: number, y: number, z: number): [number, number] {
        const n = Math.pow(2, z);
        const lon_deg = x / n * 360.0 - 180.0;
        const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        const lat_deg = lat_rad * (180.0 / Math.PI);
        return [lon_deg, lat_deg];
    }

    private tileCoordinatesToPolygon(tileX: number, tileY: number, label: string = "", progress: number = 1): GeoJSON.Feature {
        return {
            type: "Feature",
            geometry: {
                type: "Polygon",
                coordinates: [
                    [
                        this.lngLatFromTileCoords(tileX, tileY, TILES_ZOOM),
                        this.lngLatFromTileCoords(tileX + progress, tileY, TILES_ZOOM),
                        this.lngLatFromTileCoords(tileX + progress, tileY + 1, TILES_ZOOM),
                        this.lngLatFromTileCoords(tileX, tileY + 1, TILES_ZOOM),
                        this.lngLatFromTileCoords(tileX, tileY, TILES_ZOOM),
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
            if (this.downloadingTile && this.downloadingTile.tileX === tileXDownloaded && this.downloadingTile.tileY === tileYDownloaded) {
                continue; // Skip tiles that are in progress
            }
            const { tileX, tileY } = this.getCenterTileXY();
            if (this.downloadingTile == null && tileXDownloaded === tileX && tileYDownloaded === tileY) {
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
        const { tileX, tileY } = this.getCenterTileXY();
        this.selectedTile = {
            type: "FeatureCollection",
            features: this.downloadingTile != null ? [] : [this.tileCoordinatesToPolygon(tileX, tileY, "לחצו\nלהורדה")]
        };
    }

    private updateInProgressTile(progress: number) {
        if (this.downloadingTile == null) {
            this.inProgressTile = { type: "FeatureCollection", features: [] };
            return;
        }
        const fillFeature = this.tileCoordinatesToPolygon(
            this.downloadingTile.tileX,
            this.downloadingTile.tileY,
            "", 
            progress / 100.0,
        );
        fillFeature.properties.fill = "true";
        const strokeFeature = this.tileCoordinatesToPolygon(
            this.downloadingTile.tileX,
            this.downloadingTile.tileY,
            progress.toFixed(2) + "%"
        );
        strokeFeature.properties.stroke = "true";
        this.inProgressTile = {
            type: "FeatureCollection",
            features: [fillFeature, strokeFeature]
        };
    }

    public cancelDownload() {
        this.downloadingTile = null;
        this.updateDownloadedTiles();
    }

    getCenterTileXY(): { tileX: number; tileY: number } {
        const tileCount = Math.pow(2, TILES_ZOOM);
        const mercator = MercatorCoordinate.fromLngLat(this.center);
        const tileX = Math.floor((mercator.x * tileCount));
        const tileY = Math.floor((mercator.y * tileCount));
        return { tileX, tileY };

    }
}