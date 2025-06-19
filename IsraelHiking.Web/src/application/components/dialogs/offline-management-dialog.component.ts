import { Component, inject } from "@angular/core";
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogTitle } from "@angular/material/dialog";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { MapMouseEvent, MercatorCoordinate, LngLatLike } from "maplibre-gl";
import { MatButton } from "@angular/material/button";
import { Angulartics2OnModule } from "angulartics2";

import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService } from "application/services/offline-files-download.service";
import { Urls } from "../../urls";
import type { ApplicationState } from "../../models/models";

const TILES_ZOOM = 7;

@Component({
    selector: "offline-management-dialog",
    templateUrl: "./offline-management-dialog.component.html",
    styleUrls: ["./offline-management-dialog.component.scss"],
    imports: [MapComponent, Angulartics2OnModule, MatDialogActions, MatDialogTitle, MatDialogClose, MatButton, LayerComponent, GeoJSONSourceComponent],
})
export class OfflineManagementDialogComponent {
    public selectedTabIndex: number = 0;
    public offlineMapStyleUrl: string = Urls.HIKING_TILES_ADDRESS;
    public initialCenter: LngLatLike;
    public tilesGrid: GeoJSON.FeatureCollection = { features: [], type: "FeatureCollection" };

    private inProgressTilesList: Record<string, number> = {};
    private center: LngLatLike;

    private readonly OfflineFilesDownloadService = inject(OfflineFilesDownloadService);
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
        this.updateTilesGrid();
    }

    public async downloadCenter() {
        this.selectedTabIndex = 1;
        const tileCount = Math.pow(2, TILES_ZOOM);
        const mercator = MercatorCoordinate.fromLngLat(this.center);
        const tileX = Math.floor((mercator.x * tileCount));
        const tileY = Math.floor((mercator.y * tileCount));

        this.inProgressTilesList[`${tileX}-${tileY}`] = 0;
        this.updateTilesGrid();

        await this.OfflineFilesDownloadService.downloadTile(tileX, tileY, (progressValue: number) => {
            this.inProgressTilesList[`${tileX}-${tileY}`] = progressValue;
            this.updateTilesGrid();
            if (progressValue === 100) {
                delete this.inProgressTilesList[`${tileX}-${tileY}`];
            }
        });
        if (this.inProgressTilesList[`${tileX}-${tileY}`] != null) {
            delete this.inProgressTilesList[`${tileX}-${tileY}`];
            // HM TODO: in case of error - show a message to the user?
        }
        this.updateTilesGrid();
    }

    public onMoveEnd(event: MapMouseEvent) {
        this.center = event.target.getCenter();
        this.updateTilesGrid();
    }

    private lngLatFromTileCoords(x: number, y: number, z: number): [number, number] {
        const n = Math.pow(2, z);
        const lon_deg = x / n * 360.0 - 180.0;
        const lat_rad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
        const lat_deg = lat_rad * (180.0 / Math.PI);
        return [lon_deg, lat_deg];
    }

    private tileCoordinatesToPolygon(tileX: number, tileY: number, color: string, label: string, progress: number): GeoJSON.Feature {
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
                color,
                label,
                fillColor: progress === 1 ? "transparent" : color,
            }
        }
    }

    private updateTilesGrid() {
        const tileCount = Math.pow(2, TILES_ZOOM);
        const mercator = MercatorCoordinate.fromLngLat(this.center);
        const tileX = Math.floor((mercator.x * tileCount));
        const tileY = Math.floor((mercator.y * tileCount));
        const features: GeoJSON.Feature[] = [];
        if (Object.keys(this.inProgressTilesList).length === 0) {
            features.push(this.tileCoordinatesToPolygon(tileX, tileY, "green", "לחץ\nלהורדה", 1));
        }
        const downloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.offlineState.downloadedTiles);
        for (const key of Object.keys(downloadedTiles || {})) {
            if (this.inProgressTilesList[key] != null) {
                continue; // Skip tiles that are in progress
            }
            const [tileXDownloaded, tileYDownloaded] = key.split("-").map(Number);
            const downloadedDate = new Date(downloadedTiles[key]);
            const label = downloadedDate.getFullYear() + "\n" + 
                (downloadedDate.getMonth() + 1).toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), {minimumIntegerDigits: 2}) + "\n" + 
                downloadedDate.getDay().toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), {minimumIntegerDigits: 2});
            features.push(this.tileCoordinatesToPolygon(tileXDownloaded, tileYDownloaded, "orange", label, 1));
        }
        for (const key of Object.keys(this.inProgressTilesList)) {
            const [tileXInProgress, tileYInProgress] = key.split("-").map(Number);
            features.push(this.tileCoordinatesToPolygon(tileXInProgress, tileYInProgress, "rgba(0, 90, 128, 0.5)", this.inProgressTilesList[key].toFixed(1) + "%", this.inProgressTilesList[key] as number / 100));
        }
        this.tilesGrid = {
            type: "FeatureCollection",
            features
        };
    }

}