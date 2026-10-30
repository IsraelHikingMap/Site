import { Component, ChangeDetectorRef, inject, signal, computed, viewChild, type ElementRef } from "@angular/core";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import { type Map, type MapMouseEvent, MercatorCoordinate, type StyleSpecification } from "maplibre-gl";
import { MatButton } from "@angular/material/button";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatProgressBar } from "@angular/material/progress-bar";
import { Dir } from "@angular/cdk/bidi";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { DatePipe, NgClass } from "@angular/common";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService, type TileCompatibility } from "../../services/offline-files-download.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { PmTilesService, TILES_ZOOM } from "../../services/pmtiles.service";
import { OfflineTileNamesService } from "../../services/offline-tile-names.service";
import { SpatialHelper } from "../../services/spatial.helper";
import { SetTileNameAction } from "../../reducers/offline.reducer";
import { DEFAULT_BASE_LAYERS, HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState, EditableLayer } from "../../models";

/** A downloaded tile as the list shows it */
export type DownloadedTileRow = {
    tileKey: string;
    tileX: number;
    tileY: number;
    /** The name the user gave the tile, falling back to the coordinates of its center */
    name: string;
    /** When the tile was last downloaded, null while it is downloaded for the first time */
    downloadedDate: Date;
    compatibility: TileCompatibility;
};

@Component({
    selector: "offline-management",
    templateUrl: "./offline-management.component.html",
    imports: [MapComponent, AnalyticsDirective, MatButton, LayerComponent, GeoJSONSourceComponent, AutomaticLayerPresentationComponent, MatButtonToggle, MatButtonToggleGroup, MatMenu, MatMenuItem, MatMenuTrigger, DatePipe, NgClass, FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatError, MatInput, MatProgressBar, Dir]
})
export class OfflineManagementComponent {
    /**
     * The color a downloaded tile is drawn in: orange when only the style that was downloaded now asks
     * for more than the tile holds, which is something to do rather than something that is broken, and
     * red when the styles that are already on the device do, which is what draws the map itself wrong.
     */
    private static readonly TILE_COLOR: Record<TileCompatibility, string> = {
        compatible: "blue",
        outdated: "#ef6c00",
        unusable: "red"
    };

    /** The order the list shows the tiles in, the ones that need to be downloaded again first */
    private static readonly COMPATIBILITY_ORDER: Record<TileCompatibility, number> = {
        unusable: 0,
        outdated: 1,
        compatible: 2
    };

    public readonly offlineMapStyle: StyleSpecification;
    public readonly currentLocation: GeoJSON.FeatureCollection;
    public readonly baseLayerData: EditableLayer;
    public readonly selectedTileXY = signal<{ tileX: number; tileY: number }>(null);
    /**
     * Whether a narrow screen shows the map rather than the list. It starts on the map when nothing was
     * downloaded yet, since the map is where a tile is selected to be downloaded.
     */
    public readonly showMap = signal(false);
    /** The tile whose name is being edited in the list */
    public readonly editedTileKey = signal<string>(null);
    /** The name being edited, which is invalid when another tile already has it */
    public readonly nameControl = new FormControl("", {
        nonNullable: true,
        validators: control => this.isNameInUse(control.value) ? { nameInUse: true } : null
    });
    private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>("nameInput");

    private map: Map;

    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly toastService = inject(ToastService);
    private readonly offlineTileNamesService = inject(OfflineTileNamesService);
    private readonly store = inject(Store);
    private readonly changeDetectorRef = inject(ChangeDetectorRef);
    private readonly downloadedTilesState = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.downloadedTiles);
    private readonly tileNames = this.store.selectSignal((s: ApplicationState) => s.offlineState.tileNames);
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
     * The tiles that are on the device but can no longer be used, sorted so that moving to the next one
     * keeps the same order every time. The root files are not of a specific tile, so they are not here -
     * they are not drawn on the map either, and they are updated along with any tile that is downloaded.
     */
    public readonly incompatibleTileKeys = computed<string[]>(() => {
        const downloadedTiles = this.downloadedTilesState();
        return Object.keys(downloadedTiles)
            .filter(tileKey => PmTilesService.fromTileKey(tileKey) != null)
            .filter(tileKey => this.offlineFilesDownloadService.getTileCompatibility(tileKey, downloadedTiles[tileKey]) !== "compatible")
            .sort();
    });

    /**
     * The downloaded tiles, the root files are not of a specific tile and are not listed. A tile that is
     * downloaded for the first time is listed from the moment its download starts, at the top, so that
     * its progress shows in the list and not only on the map.
     */
    public readonly downloadedTileRows = computed<DownloadedTileRow[]>(() => {
        const downloadedTiles = this.downloadedTilesState();
        const rows: DownloadedTileRow[] = [];
        for (const [tileKey, files] of Object.entries(downloadedTiles)) {
            const tile = PmTilesService.fromTileKey(tileKey);
            if (tile == null) {
                continue;
            }
            rows.push(this.toRow(tile.tileX, tile.tileY, this.offlineFilesDownloadService.getLastModifiedDate(files),
                this.offlineFilesDownloadService.getTileCompatibility(tileKey, files)));
        }
        rows.sort((a, b) =>
            OfflineManagementComponent.COMPATIBILITY_ORDER[a.compatibility] - OfflineManagementComponent.COMPATIBILITY_ORDER[b.compatibility] ||
            b.downloadedDate.getTime() - a.downloadedDate.getTime());
        const downloadingTile = this.downloadingTile();
        if (downloadingTile != null && downloadedTiles[PmTilesService.toTileKey(downloadingTile.tileX, downloadingTile.tileY)] == null) {
            rows.unshift(this.toRow(downloadingTile.tileX, downloadingTile.tileY, null, "compatible"));
        }
        return rows;
    });

    public readonly isSelectedIncompatible = computed(() => {
        const selectedTileXY = this.selectedTileXY();
        if (selectedTileXY == null) {
            return false;
        }
        return this.incompatibleTileKeys().includes(PmTilesService.toTileKey(selectedTileXY.tileX, selectedTileXY.tileY));
    });

    /**
     * What to tell the user below the buttons: how many tiles need to be downloaded again, falling back to
     * explaining how a tile is selected. The count is kept while a tile is selected rather than being
     * replaced by something about that tile, so that the user can see how many are left as they go over
     * them. Nothing is said while a tile is being downloaded, the progress on the tile itself says it.
     */
    public readonly statusMessage = computed<string>(() => {
        if (this.downloadingTile() != null) {
            return null;
        }
        const incompatibleCount = this.incompatibleTileKeys().length;
        if (incompatibleCount === 1) {
            return this.resources.oneTileNeedsToBeDownloadedAgain;
        }
        if (incompatibleCount > 1) {
            return this.resources.tilesNeedToBeDownloadedAgain.replace("{{count}}", incompatibleCount.toString());
        }
        return this.selectedTileXY() == null ? this.resources.clickTheMapToSelectATile : null;
    });

    /** Whether the message is about tiles that need to be downloaded again and not just an explanation */
    public readonly isStatusWarning = computed(() =>
        this.downloadingTile() == null && this.incompatibleTileKeys().length > 0);

    /**
     * The tiles that were downloaded, drawn from the files that are on the device - they are read into
     * the state while the app is running, so this follows it instead of being built once.
     * The tile that is being downloaded and the selected one are drawn on their own, so they are skipped.
     * A tile that can no longer be used is marked with a "!" rather than with the date it was downloaded
     * at, which is not the reason it can't be used, and is drawn with a dashed outline so that it is told
     * apart from the rest without relying on its color alone.
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

            const compatibility = this.offlineFilesDownloadService.getTileCompatibility(tileKey, downloadedTiles[tileKey]);
            const isCompatible = compatibility === "compatible";
            let label = "!";
            if (isCompatible) {
                const downloadedDate = this.offlineFilesDownloadService.getLastModifiedDate(downloadedTiles[tileKey]);
                label = downloadedDate.getFullYear() + "\n" +
                    (downloadedDate.getMonth() + 1).toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), { minimumIntegerDigits: 2 }) + "\n" +
                    downloadedDate.getDate().toLocaleString(this.resources.getCurrentLanguageCodeSimplified(), { minimumIntegerDigits: 2 });
            }
            const feature = this.tileCoordinatesToPolygon(tileXDownloaded, tileYDownloaded, label, 1);
            feature.properties.color = OfflineManagementComponent.TILE_COLOR[compatibility];
            feature.properties.incompatible = isCompatible ? "false" : "true";
            feature.properties.textSize = isCompatible ? 30 : 60;
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
        this.showMap.set(this.downloadedTileRows().length === 0);
        this.nameUnnamedTiles();
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
            center: SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: (minTileX + maxTileX + 1) / 2, y: (minTileY + maxTileY + 1) / 2 }, TILES_ZOOM)),
            zoom: Math.max(1, TILES_ZOOM - Math.log2(Math.max(maxTileX - minTileX + 1, maxTileY - minTileY + 1)) - 1)
        });
    }

    public downloadSelected() {
        const { tileX, tileY } = this.selectedTileXY();
        return this.downloadTile(tileX, tileY);
    }

    public async downloadTile(tileX: number, tileY: number) {
        this.toastService.info(this.resources.dontSwitchApps);
        this.offlineTileNamesService.nameTile(tileX, tileY);
        this.map.flyTo({
            center: SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM)),
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
                        SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX, y: tileY }, TILES_ZOOM)),
                        SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX + progress, y: tileY }, TILES_ZOOM)),
                        SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX + progress, y: tileY + 1 }, TILES_ZOOM)),
                        SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX, y: tileY + 1 }, TILES_ZOOM)),
                        SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX, y: tileY }, TILES_ZOOM))
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
        this.selectTile(tileX, tileY);
    }

    /**
     * Shows a tile of the list on the map, which on a narrow screen means switching to the map. The map
     * is only resized once it is shown, and moving it before that centers the tile on the old size.
     */
    public async showOnMap(row: DownloadedTileRow) {
        if (this.editedTileKey() === row.tileKey) {
            return;
        }
        this.showMap.set(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.selectTile(row.tileX, row.tileY);
    }

    /**
     * Names the tiles that were downloaded before tiles had names, or whose naming failed, one at a time
     * so that opening the screen does not send a burst of queries.
     */
    private async nameUnnamedTiles() {
        for (const row of this.downloadedTileRows()) {
            await this.offlineTileNamesService.nameTile(row.tileX, row.tileY);
        }
    }

    private toRow(tileX: number, tileY: number, downloadedDate: Date, compatibility: TileCompatibility): DownloadedTileRow {
        const tileKey = PmTilesService.toTileKey(tileX, tileY);
        const center = SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM));
        return {
            tileKey,
            tileX,
            tileY,
            name: this.tileNames()[tileKey] ?? `${center[1].toFixed(2)}, ${center[0].toFixed(2)}`,
            downloadedDate,
            compatibility
        };
    }

    /**
     * Starts editing the name of a tile. The input is rendered and focused while still handling the click,
     * since a mobile browser only brings up the keyboard for a focus that comes from the user's touch.
     */
    public editTileName(tileKey: string) {
        this.editedTileKey.set(tileKey);
        this.nameControl.reset(this.downloadedTileRows().find(row => row.tileKey === tileKey)?.name ?? "");
        this.changeDetectorRef.detectChanges();
        this.nameInput()?.nativeElement.select();
    }

    /** Saves the typed name, unless another tile has it, in which case the editing goes on */
    public saveTileName(tileKey: string) {
        if (this.nameControl.invalid) {
            return;
        }
        this.store.dispatch(new SetTileNameAction(tileKey, this.nameControl.value.trim()));
        this.editedTileKey.set(null);
    }

    /**
     * Ends the editing when the input loses the focus, dropping a name another tile has rather than
     * leaving an input open that the user already moved away from.
     */
    public endTileNameEditing(tileKey: string) {
        if (this.nameControl.invalid) {
            this.editedTileKey.set(null);
            return;
        }
        this.saveTileName(tileKey);
    }

    private isNameInUse(name: string): boolean {
        return this.downloadedTileRows().some(row => row.tileKey !== this.editedTileKey() && row.name === name.trim());
    }

    public isDownloading(row: DownloadedTileRow): boolean {
        return this.downloadingTile()?.tileX === row.tileX && this.downloadingTile()?.tileY === row.tileY;
    }

    public getTileColor(row: DownloadedTileRow): string {
        return OfflineManagementComponent.TILE_COLOR[row.compatibility];
    }

    private selectTile(tileX: number, tileY: number) {
        this.selectedTileXY.set({ tileX, tileY });
        this.map.flyTo({
            center: SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM)),
            zoom: TILES_ZOOM - 1
        });
    }

    /**
     * Moves to the tile that needs to be downloaded again after the one that is selected, so that the user
     * can go over them one at a time and download each one when they want to. It goes back to the first one
     * after the last, since a tile stays in the list until it is downloaded again or deleted.
     */
    public selectNextIncompatible() {
        const incompatibleTileKeys = this.incompatibleTileKeys();
        if (incompatibleTileKeys.length === 0) {
            return;
        }
        const selectedTileXY = this.selectedTileXY();
        const selectedTileKey = selectedTileXY == null
            ? null
            : PmTilesService.toTileKey(selectedTileXY.tileX, selectedTileXY.tileY);
        const nextIndex = (incompatibleTileKeys.indexOf(selectedTileKey) + 1) % incompatibleTileKeys.length;
        const { tileX, tileY } = PmTilesService.fromTileKey(incompatibleTileKeys[nextIndex]);
        this.selectTile(tileX, tileY);
    }

    public onMapLoad(map: Map) {
        this.map = map;
        this.map.dragRotate.disable();
        this.map.touchZoomRotate.disableRotation();
        this.initializeCenterAndZoomFromDownloadingTile();
    }

    public deleteSelected() {
        if (!this.selectedTileXY()) {
            return;
        }
        this.deleteTile(PmTilesService.toTileKey(this.selectedTileXY().tileX, this.selectedTileXY().tileY));
    }

    public deleteTile(tileKey: string) {
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: async () => {
                await this.offlineFilesDownloadService.deleteTile(tileKey);
                this.store.dispatch(new SetTileNameAction(tileKey, null));
                const selectedTileXY = this.selectedTileXY();
                if (selectedTileXY != null && PmTilesService.toTileKey(selectedTileXY.tileX, selectedTileXY.tileY) === tileKey) {
                    this.selectedTileXY.set(null);
                }
            }
        });
    }
}