import { Component, ChangeDetectorRef, inject, signal, computed, viewChild, type ElementRef, type Signal } from "@angular/core";
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
import { BatteryOptimization } from "@capawesome-team/capacitor-android-battery-optimization";
import type { Immutable } from "immer";

import { AutomaticLayerPresentationComponent } from "../map/automatic-layer-presentation.component";
import { AnalyticsDirective } from "../../directives/analytics.directive";
import { ResourcesService } from "../../services/resources.service";
import { OfflineFilesDownloadService, type AreaToDownload, type DownloadInProgress, type DownloadStatus, type AreaCompatibility } from "../../services/offline-files-download.service";
import { OfflineAreasService } from "../../services/offline-areas.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { LayersService } from "../../services/layers.service";
import { ToastService } from "../../services/toast.service";
import { RunningContextService } from "../../services/running-context.service";
import { SpatialHelper } from "../../services/spatial.helper";
import { DEFAULT_BASE_LAYERS, HIKING_MAP, MTB_MAP } from "../../reducers/initial-state";
import type { ApplicationState, EditableLayer, OfflineArea } from "../../models";

/** A downloaded area as the list shows it, where an old tile is an area as well */
export type DownloadedAreaRow = {
    id: string;
    /** The area as it is kept on the device, null for files whose area could not be read */
    area: Immutable<OfflineArea> | null;
    /** The name of the area, falling back to its id, which for an old tile is its x and y */
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
    /**
     * The areas the user selected, ones the server offers or ones that were downloaded. Clicking an area on the map adds
     * it or takes it out again, so that several areas are downloaded together.
     */
    public readonly selectedAreas = signal<Immutable<OfflineArea>[]>([]);
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
    private readonly runningContextService = inject(RunningContextService);
    private readonly offlineAreasService = inject(OfflineAreasService);
    private readonly store = inject(Store);
    private readonly changeDetectorRef = inject(ChangeDetectorRef);
    private readonly downloadedAreas = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.downloadedAreas);
    public readonly resources = inject(ResourcesService);

    /** The areas that are being downloaded right now and how far each of them got, empty when there is no download */
    public readonly downloadsInProgress: Signal<DownloadInProgress[]> = this.offlineFilesDownloadService.downloadsInProgress;

    public readonly isDownloadInProgress = computed(() => this.downloadsInProgress().length > 0);

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
        rows.unshift(...this.downloadsInProgress()
            .filter(({ area }) => downloadedAreas[area.properties.id] == null)
            .map(({ area }) => this.toRow(area.properties.id, null, "compatible", area)));
        return rows;
    });

    /** The selected areas a download brings something to: the ones that were not downloaded and the downloaded ones the server still offers */
    public readonly downloadableSelectedAreas = computed(() =>
        this.selectedAreas().filter(area => !this.isDownloaded(area) || this.offeredAreaIds().has(area.properties.id)));

    /**
     * What downloading the selected areas does, which is what the button says: a new download when one of them was not
     * downloaded yet, otherwise downloading again when one of them can not be used and updating them when all of them can.
     */
    public readonly downloadSelectedKind = computed<"new" | "again" | "update">(() => {
        const areas = this.downloadableSelectedAreas();
        if (areas.some(area => !this.isDownloaded(area))) {
            return "new";
        }
        return areas.some(area => this.incompatibleAreaIds().includes(area.properties.id)) ? "again" : "update";
    });

    /** Whether the selected areas can be deleted, which is when all of them were downloaded */
    public readonly areAllSelectedDownloaded = computed(() =>
        this.selectedAreas().length > 0 && this.selectedAreas().every(area => this.isDownloaded(area)));

    /**
     * What to tell the user below the buttons: how many areas need to be downloaded again, falling back to
     * explaining how an area is selected. The count is kept while an area is selected rather than being
     * replaced by something about that area, so that the user can see how many are left as they go over
     * them. Nothing is said during a download, the progress on the map says it.
     */
    public readonly statusMessage = computed<string>(() => {
        if (this.isDownloadInProgress()) {
            return null;
        }
        const incompatibleCount = this.incompatibleAreaIds().length;
        if (incompatibleCount === 1) {
            return this.resources.oneAreaNeedsToBeDownloadedAgain;
        }
        if (incompatibleCount > 1) {
            return this.resources.areasNeedToBeDownloadedAgain.replace("{{count}}", incompatibleCount.toString());
        }
        return this.selectedAreas().length === 0 ? this.resources.clickTheMapToSelectAnArea : null;
    });

    /** Whether the message is about areas that need to be downloaded again and not just an explanation */
    public readonly isStatusWarning = computed(() =>
        !this.isDownloadInProgress() && this.incompatibleAreaIds().length > 0);

    /**
     * The areas that were downloaded, drawn from the files that are on the device - they are read into
     * the state while the app is running, so this follows it instead of being built once.
     * The areas that are being downloaded and the selected ones are drawn on their own, so they are skipped.
     * An area is labeled with its name and the date it was downloaded at. One that can no longer be used is marked
     * with a "!" rather than with the date, which is not the reason it can't be used, and is drawn with a dashed outline so that it is told
     * apart from the rest without relying on its color alone.
     */
    public readonly downloadedAreasFeatures = computed<GeoJSON.FeatureCollection>(() => {
        const features: GeoJSON.Feature[] = [];
        for (const row of this.downloadedAreaRows()) {
            if (row.area == null || this.getDownloadInProgress(row) != null || this.isSelected(row.id)) {
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

    /** The areas the user selected with their names, they are not drawn during a download */
    public readonly selectedAreaFeatures = computed<GeoJSON.FeatureCollection>(() => {
        if (this.isDownloadInProgress()) {
            return { type: "FeatureCollection", features: [] };
        }
        const features = this.selectedAreas().flatMap(area =>
            [area as OfflineArea, this.getLabelPoint(area, this.offlineAreasService.getName(area) ?? area.properties.id)]);
        return { type: "FeatureCollection", features };
    });

    /** The areas that are being downloaded, each filled from its left up to the part of its width its progress is at */
    public readonly inProgress = computed<GeoJSON.FeatureCollection>(() => ({
        type: "FeatureCollection",
        features: this.downloadsInProgress().flatMap(({ area, progress }) => [
            { ...SpatialHelper.clipFromWest(area, progress / 100.0), properties: { fill: "true" } },
            { ...area as OfflineArea, properties: {} },
            this.getLabelPoint(area, progress.toFixed(2) + "%")
        ])
    }));

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
                zoom: 7
            });
            return;
        }
        this.fitBounds({ type: "FeatureCollection", features: areas });
    }

    public downloadSelected() {
        return this.downloadAreas(this.downloadableSelectedAreas());
    }

    /**
     * Downloads areas together, in the order they were selected. The user confirms first when the download is going to
     * delete the areas they replace, see OfflineFilesDownloadService.getReplacedAreaIds.
     */
    public downloadAreas(areas: Immutable<OfflineArea>[]) {
        const areasToDownload = areas.map(area => this.toAreaToDownload(area));
        const replacedAreaIds = [...new Set(areasToDownload.flatMap(({ replacedAreaIds }) => replacedAreaIds))];
        if (replacedAreaIds.length === 0) {
            this.startDownload(areasToDownload);
            return;
        }
        const names = this.downloadedAreaRows().filter(row => replacedAreaIds.includes(row.id)).map(row => row.name);
        this.toastService.confirm({
            message: this.resources.downloadingThisAreaDeletesOldAreas.replace("{{names}}", names.join(", ")),
            type: "OkCancel",
            confirmAction: () => this.startDownload(areasToDownload)
        });
    }

    /**
     * An area in the shape the server offers it now, where an area that was downloaded before keeps the name the user
     * gave it, along with the areas it replaces.
     */
    private toAreaToDownload(area: Immutable<OfflineArea>): AreaToDownload {
        const id = area.properties.id;
        const offeredArea = this.areas().find(offered => offered.properties.id === id) ?? area;
        const downloadedArea = this.downloadedAreas()[id]?.area;
        const areaToDownload = downloadedArea == null ? offeredArea : { ...offeredArea, properties: downloadedArea.properties };
        return { area: areaToDownload, replacedAreaIds: this.offlineFilesDownloadService.getReplacedAreaIds(areaToDownload, this.offeredAreaIds()) };
    }

    /** The areas whose download did not finish are selected again, so that they can be downloaded again */
    private async startDownload(areasToDownload: AreaToDownload[]) {
        const areas = areasToDownload.map(({ area }) => area);
        this.askToTurnOffBatteryOptimization();
        this.fitBounds({ type: "FeatureCollection", features: areas });
        this.selectedAreas.set([]);
        const statuses = await this.offlineFilesDownloadService.downloadAreas(areasToDownload);
        this.selectedAreas.set(areas.filter((_, index) => statuses[index] === "error" || statuses[index] === "aborted"));
        this.reportDownloadEnd(statuses);
    }

    /**
     * Asks to turn off the battery optimization of the app on android, which can stop the download once the app is in the
     * background. The download does not wait for the answer, it starts either way.
     */
    private async askToTurnOffBatteryOptimization() {
        if (!this.runningContextService.isCapacitor || this.runningContextService.isIos) {
            return;
        }
        const { enabled } = await BatteryOptimization.isBatteryOptimizationEnabled();
        if (!enabled) {
            return;
        }
        this.toastService.confirm({
            message: this.resources.turnOffBatteryOptimizationForDownload,
            type: "OkCancel",
            confirmAction: () => BatteryOptimization.openBatteryOptimizationSettings()
        });
    }

    /** Tells how the download of the areas ended, where an area that failed outweighs the ones that did not */
    private reportDownloadEnd(statuses: DownloadStatus[]) {
        if (statuses.includes("error")) {
            this.toastService.warning(this.resources.unexpectedErrorPleaseTryAgainLater);
        } else if (statuses.includes("aborted")) {
            return;
        } else if (statuses.every(status => status === "up-to-date")) {
            this.toastService.success(this.resources.allFilesAreUpToDate);
        } else {
            this.toastService.success(this.resources.downloadFinishedSuccessfully);
        }
    }

    private getLabelPoint(area: Immutable<OfflineArea>, label: string, properties: Record<string, string | number> = {}): GeoJSON.Feature<GeoJSON.Point> {
        const coordinates = SpatialHelper.getLabelPosition(area.geometry, OfflineManagementComponent.LABEL_PRECISION_DEGREES);
        return { type: "Feature", properties: { ...properties, label }, geometry: { type: "Point", coordinates } };
    }

    public cancelDownload() {
        this.offlineFilesDownloadService.abortCurrentDownload();
    }

    /**
     * Adds the clicked area to the selection, or takes it out when it is already selected. The map is not moved, so that
     * the next area can be clicked where it is. Clicking outside of every area clears the selection.
     */
    public onMapClick(event: MapMouseEvent) {
        const area = this.offlineAreasService.findArea(this.areas(), event.lngLat);
        if (area == null) {
            this.selectedAreas.set([]);
            return;
        }
        const id = area.properties.id;
        if (this.isSelected(id)) {
            this.selectedAreas.update(areas => areas.filter(selected => selected.properties.id !== id));
            return;
        }
        this.selectedAreas.update(areas => [...areas, this.downloadedAreas()[id]?.area ?? area]);
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
            name: (area == null ? null : this.offlineAreasService.getName(area)) ?? id,
            downloadedDate,
            compatibility,
            canBeUpdated: this.offeredAreaIds().has(id)
        };
    }

    /** An area as it is kept on the device, null when its metadata could not be read */
    private getDownloadedArea(id: string): Immutable<OfflineArea> | null {
        return this.downloadedAreas()[id]?.area ?? null;
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

    public getDownloadInProgress(row: DownloadedAreaRow): DownloadInProgress | undefined {
        return this.downloadsInProgress().find(({ area }) => area.properties.id === row.id);
    }

    private isSelected(id: string): boolean {
        return this.selectedAreas().some(area => area.properties.id === id);
    }

    private isDownloaded(area: Immutable<OfflineArea>): boolean {
        return this.downloadedAreas()[area.properties.id] != null;
    }

    public getAreaColor(row: DownloadedAreaRow): string {
        return OfflineManagementComponent.AREA_COLOR[row.compatibility];
    }

    /** Selects only the given area and moves the map to it */
    private selectArea(area: Immutable<OfflineArea>) {
        this.selectedAreas.set([area]);
        this.fitBounds(area);
    }

    private fitBounds(geoJson: Immutable<GeoJSON.Feature | GeoJSON.FeatureCollection>) {
        const bounds = geoJson.type === "FeatureCollection" ? SpatialHelper.getBoundsForFeatureCollection(geoJson) : SpatialHelper.getBoundsForFeature(geoJson);
        this.map.fitBounds(SpatialHelper.boundsToMBBounds(bounds), { padding: { top: 100, bottom: 150, left: 50, right: 50 } });
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
        const nextIndex = (incompatibleAreaIds.indexOf(this.selectedAreas().at(-1)?.properties.id) + 1) % incompatibleAreaIds.length;
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
        this.deleteAreas(this.selectedAreas().map(area => area.properties.id));
    }

    public deleteAreas(ids: string[]) {
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: async () => {
                for (const id of ids) {
                    await this.offlineFilesDownloadService.deleteArea(id);
                }
                this.selectedAreas.update(areas => areas.filter(area => !ids.includes(area.properties.id)));
            }
        });
    }
}
