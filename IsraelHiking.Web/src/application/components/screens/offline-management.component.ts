import { Component, ChangeDetectorRef, inject, signal, computed, viewChild, type ElementRef } from "@angular/core";
import { Store } from "@ngxs/store";
import { GeoJSONSourceComponent, LayerComponent, MapComponent } from "@maplibre/ngx-maplibre-gl";
import type { Map, MapMouseEvent, StyleSpecification } from "maplibre-gl";
import { MatButton } from "@angular/material/button";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { MatError, MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatProgressBar } from "@angular/material/progress-bar";
import { Dir } from "@angular/cdk/bidi";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { DatePipe, NgClass } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { form, FormField, validate } from "@angular/forms/signals";
import { ErrorStateMatcher, ShowOnDirtyErrorStateMatcher } from "@angular/material/core";
import type { Immutable } from "immer";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService, type DownloadStatus, type AreaCompatibility } from "../../services/offline-files-download.service";
import { OfflineAreasService, TILES_ZOOM } from "../../services/offline-areas.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { SpatialHelper } from "../../services/spatial.helper";
import { DEFAULT_BASE_LAYERS, HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState, EditableLayer, OfflineArea } from "../../models";

/** A downloaded area as the list shows it, where an old tile is an area as well */
export type DownloadedAreaRow = {
    id: string;
    /** The area as it is kept on the device, null for files whose area could not be read */
    area: Immutable<OfflineArea> | null;
    /** The name of the area, falling back to the coordinates of the middle of an old tile the user did not name */
    name: string;
    /** When the area was last downloaded, null while it is downloaded for the first time */
    downloadedDate: Date;
    compatibility: AreaCompatibility;
    /**
     * Whether the server still offers the area. An area whose shape changed got a new id and an old tile has none of
     * the server's, so either can only be deleted and replaced by an area the server offers.
     */
    canBeUpdated: boolean;
};

@Component({
    selector: "offline-management",
    templateUrl: "./offline-management.component.html",
    imports: [MapComponent, AnalyticsDirective, MatButton, LayerComponent, GeoJSONSourceComponent, AutomaticLayerPresentationComponent, MatButtonToggle, MatButtonToggleGroup, MatMenu, MatMenuItem, MatMenuTrigger, DatePipe, NgClass, FormsModule, FormField, MatFormField, MatLabel, MatError, MatInput, MatProgressBar, Dir],
    providers: [{ provide: ErrorStateMatcher, useClass: ShowOnDirtyErrorStateMatcher }]
})
export class OfflineManagementComponent {
    /** How close to the best place inside an area its label is put, finer only costs more time */
    private static readonly LABEL_PRECISION_DEGREES = 0.01;

    /**
     * The color a downloaded area is drawn in: orange when only the style that was downloaded now asks
     * for more than the area holds, which is something to do rather than something that is broken, and
     * red when the styles that are already on the device do, which is what draws the map itself wrong.
     */
    private static readonly AREA_COLOR: Record<AreaCompatibility, string> = {
        compatible: "blue",
        outdated: "#ef6c00",
        unusable: "red"
    };

    /** The order the list shows the areas in, the ones that need to be downloaded again first */
    private static readonly COMPATIBILITY_ORDER: Record<AreaCompatibility, number> = {
        unusable: 0,
        outdated: 1,
        compatible: 2
    };

    public readonly offlineMapStyle: StyleSpecification;
    public readonly currentLocation: GeoJSON.FeatureCollection;
    public readonly baseLayerData: EditableLayer;
    /** The areas that can be downloaded, fetched every time the screen is opened, so that the ones shown are the ones the server offers now */
    public readonly areas = signal<OfflineArea[]>([]);
    private readonly offeredAreaIds = computed(() => new Set(this.areas().map(area => area.properties.id)));
    /** The area the user selected, one the server offers or one that was downloaded */
    public readonly selectedArea = signal<Immutable<OfflineArea>>(null);
    /** Whether a narrow screen shows the map rather than the list, the map is where an area is selected to be downloaded */
    public readonly showMap = signal(true);
    /** The area whose name is being edited in the list */
    public readonly editedAreaId = signal<string>(null);
    public readonly editedName = signal("");
    /** The name being edited, which is invalid when another area already has it */
    public readonly nameForm = form(this.editedName, path => {
        validate(path, ({ value }) => this.isNameInUse(value()) ? { kind: "nameInUse" } : null);
    });
    private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>("nameInput");

    private map: Map;

    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly layersService = inject(LayersService);
    private readonly toastService = inject(ToastService);
    private readonly offlineAreasService = inject(OfflineAreasService);
    private readonly store = inject(Store);
    private readonly changeDetectorRef = inject(ChangeDetectorRef);
    private readonly downloadedAreas = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.downloadedAreas);
    public readonly resources = inject(ResourcesService);

    /** The area that is being downloaded right now and how far it got, null when there is no download */
    public readonly downloadInProgress = this.offlineFilesDownloadService.downloadInProgress;

    public readonly isSelectedDownloaded = computed(() =>
        this.selectedArea() != null && this.downloadedAreas()[this.selectedArea().properties.id] != null);

    /**
     * The areas that are on the device but can no longer be used, sorted so that moving to the next one
     * keeps the same order every time. The root files are not of a specific area, so they are not here -
     * they are not drawn on the map either, and they are updated along with any area that is downloaded.
     */
    public readonly incompatibleAreaIds = computed<string[]>(() => {
        const downloadedAreas = this.downloadedAreas();
        return Object.keys(downloadedAreas)
            .filter(id => !OfflineAreasService.isRootId(id))
            .filter(id => this.offlineFilesDownloadService.getAreaCompatibility(id, downloadedAreas[id].files) !== "compatible")
            .sort();
    });

    /**
     * The downloaded areas, the root files are not of a specific area and are not listed. An area that is
     * downloaded for the first time is listed from the moment its download starts, at the top, so that
     * its progress shows in the list and not only on the map.
     */
    public readonly downloadedAreaRows = computed<DownloadedAreaRow[]>(() => {
        const downloadedAreas = this.downloadedAreas();
        const rows = Object.entries(downloadedAreas)
            .filter(([id]) => !OfflineAreasService.isRootId(id))
            .map(([id, { files }]) => this.toRow(id, this.offlineFilesDownloadService.getLastModifiedDate(files),
                this.offlineFilesDownloadService.getAreaCompatibility(id, files)));
        rows.sort((a, b) =>
            OfflineManagementComponent.COMPATIBILITY_ORDER[a.compatibility] - OfflineManagementComponent.COMPATIBILITY_ORDER[b.compatibility] ||
            b.downloadedDate.getTime() - a.downloadedDate.getTime());
        const downloadInProgress = this.downloadInProgress();
        if (downloadInProgress != null && downloadedAreas[downloadInProgress.area.properties.id] == null) {
            rows.unshift(this.toRow(downloadInProgress.area.properties.id, null, "compatible", downloadInProgress.area));
        }
        return rows;
    });

    public readonly isSelectedUpdatable = computed(() =>
        this.selectedArea() != null && this.offeredAreaIds().has(this.selectedArea().properties.id));

    public readonly isSelectedIncompatible = computed(() =>
        this.selectedArea() != null && this.incompatibleAreaIds().includes(this.selectedArea().properties.id));

    /**
     * What to tell the user below the buttons: how many areas need to be downloaded again, falling back to
     * explaining how an area is selected. The count is kept while an area is selected rather than being
     * replaced by something about that area, so that the user can see how many are left as they go over
     * them. Nothing is said during a download, the progress on the map says it.
     */
    public readonly statusMessage = computed<string>(() => {
        if (this.downloadInProgress() != null) {
            return null;
        }
        const incompatibleCount = this.incompatibleAreaIds().length;
        if (incompatibleCount === 1) {
            return this.resources.oneAreaNeedsToBeDownloadedAgain;
        }
        if (incompatibleCount > 1) {
            return this.resources.areasNeedToBeDownloadedAgain.replace("{{count}}", incompatibleCount.toString());
        }
        return this.selectedArea() == null ? this.resources.clickTheMapToSelectAnArea : null;
    });

    /** Whether the message is about areas that need to be downloaded again and not just an explanation */
    public readonly isStatusWarning = computed(() =>
        this.downloadInProgress() == null && this.incompatibleAreaIds().length > 0);

    /**
     * The areas that were downloaded, drawn from the files that are on the device - they are read into
     * the state while the app is running, so this follows it instead of being built once.
     * The area that is being downloaded and the selected one are drawn on their own, so they are skipped.
     * An area is labeled with its name and the date it was downloaded at. One that can no longer be used is marked
     * with a "!" rather than with the date, which is not the reason it can't be used, and is drawn with a dashed outline so that it is told
     * apart from the rest without relying on its color alone.
     */
    public readonly downloadedAreasFeatures = computed<GeoJSON.FeatureCollection>(() => {
        const features: GeoJSON.Feature[] = [];
        for (const row of this.downloadedAreaRows()) {
            if (row.area == null || row.id === this.downloadInProgress()?.area.properties.id || row.id === this.selectedArea()?.properties.id) {
                continue;
            }
            const isCompatible = row.compatibility === "compatible";
            const label = isCompatible
                ? row.name + "\n" + row.downloadedDate.toLocaleDateString(this.resources.getCurrentLanguageCodeSimplified())
                : "!";
            const properties = { color: OfflineManagementComponent.AREA_COLOR[row.compatibility], incompatible: isCompatible ? "false" : "true" };
            features.push({ ...row.area as OfflineArea, properties }, this.getLabelPoint(row.area, label, { ...properties, textSize: isCompatible ? 20 : 60 }));
        }
        return { type: "FeatureCollection", features };
    });

    public readonly areasCollection = computed<GeoJSON.FeatureCollection>(() => ({ type: "FeatureCollection", features: this.areas() }));

    /** The area the user selected with its name, it is not drawn during a download */
    public readonly selectedAreaFeatures = computed<GeoJSON.FeatureCollection>(() => {
        const selectedArea = this.selectedArea();
        if (selectedArea == null || this.downloadInProgress() != null) {
            return { type: "FeatureCollection", features: [] };
        }
        const name = this.offlineAreasService.getName(selectedArea) ?? this.getDefaultName(selectedArea.properties.id);
        return { type: "FeatureCollection", features: [selectedArea as OfflineArea, this.getLabelPoint(selectedArea, name)] };
    });

    /** The area that is being downloaded, filled from its left up to the part of its width the progress is at */
    public readonly inProgress = computed<GeoJSON.FeatureCollection>(() => {
        const downloadInProgress = this.downloadInProgress();
        if (downloadInProgress == null) {
            return { type: "FeatureCollection", features: [] };
        }
        const { area, progress } = downloadInProgress;
        const fillFeature = SpatialHelper.clipFromWest(area, progress / 100.0);
        return {
            type: "FeatureCollection",
            features: [{ ...fillFeature, properties: { fill: "true" } }, { ...area as OfflineArea, properties: {} }, this.getLabelPoint(area, progress.toFixed(2) + "%")]
        };
    });

    constructor() {
        this.offlineMapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        this.baseLayerData = this.layersService.selectedBaseLayer();
        if (this.baseLayerData.key !== HIKING_MAP && this.baseLayerData.key !== MTB_MAP) {
            this.baseLayerData = { ...DEFAULT_BASE_LAYERS[0] };
        }
        this.offlineAreasService.getAreas().then(areas => this.areas.set(areas));
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

    /** Shows every downloaded area, or where the user is when there is none */
    private initializeCenterAndZoom() {
        const areas = this.downloadedAreaRows().map(row => row.area).filter(area => area != null);
        if (areas.length === 0) {
            const mapCenter = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
            this.map.flyTo({
                center: [mapCenter.longitude, mapCenter.latitude],
                zoom: TILES_ZOOM
            });
            return;
        }
        this.fitBounds({ type: "FeatureCollection", features: areas }, TILES_ZOOM - 1);
    }

    public downloadSelected() {
        return this.downloadArea(this.selectedArea());
    }

    /**
     * Downloads an area, where an area that was downloaded before is downloaded again the way it is kept on the
     * device, which might no longer be the way the server offers it. The user confirms first when the download
     * is going to delete old tiles, see OfflineFilesDownloadService.getOverlappedTileIds.
     */
    public downloadArea(area: Immutable<OfflineArea>) {
        const areaToDownload = this.downloadedAreas()[area.properties.id]?.area ?? area;
        const overlappedTileIds = this.offlineFilesDownloadService.getOverlappedTileIds(areaToDownload);
        if (overlappedTileIds.length === 0) {
            this.startDownload(areaToDownload);
            return;
        }
        const names = this.downloadedAreaRows().filter(row => overlappedTileIds.includes(row.id)).map(row => row.name);
        this.toastService.confirm({
            message: this.resources.downloadingThisAreaDeletesOldTiles.replace("{{names}}", names.join(", ")),
            type: "OkCancel",
            confirmAction: () => this.startDownload(areaToDownload)
        });
    }

    private async startDownload(areaToDownload: Immutable<OfflineArea>) {
        this.toastService.info(this.resources.dontSwitchApps);
        this.fitBounds(areaToDownload, TILES_ZOOM - 1);
        this.selectedArea.set(null);
        const status = await this.offlineFilesDownloadService.downloadArea(areaToDownload);
        this.reportDownloadEnd(status, () => this.selectedArea.set(areaToDownload));
    }

    /** What was downloaded is selected again when its download did not finish, so that it can be downloaded again */
    private reportDownloadEnd(status: DownloadStatus, selectAgain: () => void) {
        switch (status) {
            case "up-to-date":
                this.toastService.success(this.resources.allFilesAreUpToDate);
                break;
            case "downloaded":
                this.toastService.success(this.resources.downloadFinishedSuccessfully);
                break;
            case "error":
                selectAgain();
                this.toastService.warning(this.resources.unexpectedErrorPleaseTryAgainLater);
                break;
            case "aborted":
                selectAgain();
                break;
        }
    }

    private getLabelPoint(area: Immutable<OfflineArea>, label: string, properties: Record<string, string | number> = {}): GeoJSON.Feature<GeoJSON.Point> {
        const coordinates = SpatialHelper.getLabelPosition(area.geometry, OfflineManagementComponent.LABEL_PRECISION_DEGREES);
        return { type: "Feature", properties: { ...properties, label }, geometry: { type: "Point", coordinates } };
    }

    public cancelDownload() {
        this.offlineFilesDownloadService.abortCurrentDownload();
    }

    public onMapClick(event: MapMouseEvent) {
        const area = this.offlineAreasService.findArea(this.areas(), event.lngLat);
        if (area == null) {
            this.selectedArea.set(null);
            return;
        }
        this.selectArea(this.downloadedAreas()[area.properties.id]?.area ?? area);
    }

    /**
     * Shows an area of the list on the map, which on a narrow screen means switching to the map. The map
     * is only resized once it is shown, and moving it before that centers the area on the old size.
     */
    public async showOnMap(row: DownloadedAreaRow) {
        if (this.editedAreaId() === row.id || row.area == null) {
            return;
        }
        this.showMap.set(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.selectArea(row.area);
    }

    private toRow(id: string, downloadedDate: Date, compatibility: AreaCompatibility, area = this.getDownloadedArea(id)): DownloadedAreaRow {
        return {
            id,
            area,
            name: (area == null ? null : this.offlineAreasService.getName(area)) ?? this.getDefaultName(id),
            downloadedDate,
            compatibility,
            canBeUpdated: this.offeredAreaIds().has(id)
        };
    }

    /** An area as it is kept on the device, where an old tile whose metadata could not be read is the square of the tile */
    private getDownloadedArea(id: string): Immutable<OfflineArea> | null {
        const tile = OfflineAreasService.fromTileId(id);
        return this.downloadedAreas()[id]?.area ?? (tile == null ? null : OfflineAreasService.createTileArea(tile.tileX, tile.tileY));
    }

    /** What an area that has no name is called: a tile by the coordinates of its middle, anything else by its id */
    private getDefaultName(id: string): string {
        const tile = OfflineAreasService.fromTileId(id);
        if (tile == null) {
            return id;
        }
        const center = SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: tile.tileX + 0.5, y: tile.tileY + 0.5 }, TILES_ZOOM));
        return `${center[1].toFixed(2)}, ${center[0].toFixed(2)}`;
    }

    /**
     * Starts editing the name of an area. The input is rendered and focused while still handling the click,
     * since a mobile browser only brings up the keyboard for a focus that comes from the user's touch.
     */
    public editAreaName(id: string) {
        this.editedAreaId.set(id);
        this.nameForm().reset(this.downloadedAreaRows().find(row => row.id === id)?.name ?? "");
        this.changeDetectorRef.detectChanges();
        this.nameInput()?.nativeElement.select();
    }

    /** Saves the typed name, unless another area has it, in which case the editing goes on */
    public async saveAreaName(row: DownloadedAreaRow) {
        if (this.nameForm().invalid()) {
            return;
        }
        this.editedAreaId.set(null);
        await this.offlineAreasService.renameDownloadedArea(row.area, this.editedName().trim());
    }

    /**
     * Ends the editing when the input loses the focus, dropping a name another area has rather than
     * leaving an input open that the user already moved away from.
     */
    public endAreaNameEditing(row: DownloadedAreaRow) {
        if (this.nameForm().invalid()) {
            this.editedAreaId.set(null);
            return;
        }
        this.saveAreaName(row);
    }

    private isNameInUse(name: string): boolean {
        return this.downloadedAreaRows().some(row => row.id !== this.editedAreaId() && row.name === name.trim());
    }

    public isDownloading(row: DownloadedAreaRow): boolean {
        return this.downloadInProgress()?.area.properties.id === row.id;
    }

    public getAreaColor(row: DownloadedAreaRow): string {
        return OfflineManagementComponent.AREA_COLOR[row.compatibility];
    }

    private selectArea(area: Immutable<OfflineArea>) {
        this.selectedArea.set(area);
        this.fitBounds(area, TILES_ZOOM);
    }

    private fitBounds(geoJson: Immutable<GeoJSON.Feature | GeoJSON.FeatureCollection>, maxZoom: number) {
        const bounds = geoJson.type === "FeatureCollection" ? SpatialHelper.getBoundsForFeatureCollection(geoJson) : SpatialHelper.getBoundsForFeature(geoJson);
        this.map.fitBounds(SpatialHelper.boundsToMBBounds(bounds), { padding: 40, maxZoom });
    }

    /**
     * Moves to the area that needs to be downloaded again after the one that is selected, so that the user
     * can go over them one at a time and download each one when they want to. It goes back to the first one
     * after the last, since an area stays in the list until it is downloaded again or deleted.
     */
    public selectNextIncompatible() {
        const incompatibleAreaIds = this.incompatibleAreaIds();
        if (incompatibleAreaIds.length === 0) {
            return;
        }
        const nextIndex = (incompatibleAreaIds.indexOf(this.selectedArea()?.properties.id) + 1) % incompatibleAreaIds.length;
        const area = this.getDownloadedArea(incompatibleAreaIds[nextIndex]);
        if (area != null) {
            this.selectArea(area);
        }
    }

    public onMapLoad(map: Map) {
        this.map = map;
        this.map.dragRotate.disable();
        this.map.touchZoomRotate.disableRotation();
        this.initializeCenterAndZoom();
    }

    public deleteSelected() {
        if (this.selectedArea() != null) {
            this.deleteArea(this.selectedArea().properties.id);
        }
    }

    public deleteArea(id: string) {
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: async () => {
                await this.offlineFilesDownloadService.deleteArea(id);
                if (this.selectedArea()?.properties.id === id) {
                    this.selectedArea.set(null);
                }
            }
        });
    }
}
