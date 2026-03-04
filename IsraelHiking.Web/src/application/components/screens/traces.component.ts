import { Component, DestroyRef, OnInit, ViewEncapsulation, inject } from "@angular/core";
import { Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Dir } from "@angular/cdk/bidi";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { ClusterPointDirective, GeoJSONSourceComponent, LayerComponent, MapComponent, MarkerComponent, MarkersForClustersComponent, PointDirective, PopupComponent } from "@maplibre/ngx-maplibre-gl";
import { MatButton, MatAnchor } from "@angular/material/button";
import { DatePipe } from "@angular/common";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatButtonToggle, MatButtonToggleGroup } from "@angular/material/button-toggle";
import { MatDialog } from "@angular/material/dialog";
import { FormsModule } from "@angular/forms";
import { orderBy } from "lodash-es";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";
import type { StyleSpecification, Map } from "maplibre-gl";

import { SecuredImageComponent } from "../secured-image.component";
import { LayersComponent } from "../map/layers.component";
import { RoutesPathComponent } from "../map/routes-path.component";
import { MissingPartOverlayComponent } from "../overlays/missing-part-overlay.component";
import { EditTraceDialogComponent } from "../dialogs/edit-trece-dialog.component";
import { ScrollToDirective } from "../../directives/scroll-to.directive";
import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { OsmAddressesService } from "../../services/osm-addresses.service";
import { MapService } from "../../services/map.service";
import { ToastService } from "../../services/toast.service";
import { TracesService } from "../../services/traces.service";
import { RunningContextService } from "../../services/running-context.service";
import { SpatialService } from "../../services/spatial.service";
import { DataContainerService } from "../../services/data-container.service";
import { RouteStrings } from "../../services/hash.service";
import { DefaultStyleService } from "../../services/default-style.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import type { ApplicationState, LatLngAltTime, Trace, TraceVisibility } from "../../models";

@Component({
    selector: "traces",
    templateUrl: "./traces.component.html",
    styleUrls: ["./traces.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatButton, MatAnchor, Angulartics2OnModule, SecuredImageComponent, MatProgressSpinner, DatePipe, MatMenu, MatMenuTrigger, MatMenuItem, MapComponent, PopupComponent, LayersComponent, RoutesPathComponent, MarkersForClustersComponent, GeoJSONSourceComponent, ClusterPointDirective, PointDirective, MarkerComponent, MissingPartOverlayComponent, LayerComponent, GeoJSONSourceComponent, MatButtonToggle, MatButtonToggleGroup, FormsModule]
})
export class TracesComponent implements OnInit {

    public showMap = false;
    public mapStyle: StyleSpecification;
    public filteredTraces: Immutable<Trace[]>;
    public loadingTraces: boolean = false;
    public selectedTrace: Immutable<Trace> | undefined;
    public tracesGeoJson: GeoJSON.FeatureCollection<GeoJSON.Point> | undefined = {
        type: "FeatureCollection",
        features: []
    };
    public selectedTraceGeoJson: GeoJSON.FeatureCollection | undefined = {
        type: "FeatureCollection",
        features: []
    };
    public selectedFeature: GeoJSON.Feature<GeoJSON.LineString>;
    public missingCoordinates: LatLngAltTime = null;
    public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: "FeatureCollection",
        features: []
    };
    public selectedFeatureSource: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
        type: "FeatureCollection",
        features: []
    };

    public readonly resources = inject(ResourcesService);

    private readonly fileService = inject(FileService);
    private readonly mapService = inject(MapService);
    private readonly toastService = inject(ToastService);
    private readonly osmAddressesService = inject(OsmAddressesService);
    private readonly tracesService = inject(TracesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly router = inject(Router);
    private readonly store = inject(Store);
    private readonly destroyRef = inject(DestroyRef);
    private readonly dialog = inject(MatDialog);

    constructor() {
        this.mapStyle = this.defaultStyleService.getStyleWithPlaceholders();
        const location = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        this.mapStyle.zoom = location.zoom;
        this.mapStyle.center = [location.longitude, location.latitude];
        this.store.select((s: ApplicationState) => s.inMemoryState.searchTerm).pipe(takeUntilDestroyed()).subscribe(() => {
            this.runFilter();
        });
        this.store.select((state: ApplicationState) => state.tracesState.traces).pipe(takeUntilDestroyed()).subscribe(() => {
            if (!this.loadingTraces) {
                this.runFilter();
            }
        });
        this.destroyRef.onDestroy(() => {
            this.mapService.unsetMap();
        });
    }

    public async ngOnInit() {
        this.loadingTraces = true;
        await this.tracesService.syncTraces();
        this.loadingTraces = false;
        this.runFilter();
    }

    public mapLoaded(map: Map) {
        this.mapService.setMap(map);
        this.mapService.addArrowToMap(map);
    }

    public async addTraceToRoutes(shallowTrace: Immutable<Trace>) {
        const trace = await this.tracesService.getTraceById(shallowTrace.id);
        if (trace.dataContainer.routes.length === 1) {
            trace.dataContainer.routes[0].name = this.getTraceDisplayName(trace) || trace.name;
            trace.dataContainer.routes[0].description = trace.name;
        }
        this.router.navigate([RouteStrings.MAP]);
        this.dataContainerService.setData(trace.dataContainer, true);
    }

    public editTrace(shallowTrace: Immutable<Trace>) {
        this.dialog.open<EditTraceDialogComponent, Immutable<Trace>>(EditTraceDialogComponent, {
            data: shallowTrace,
        });
    }

    public deleteTrace(shallowTrace: Immutable<Trace>) {
        const message = `${this.resources.deletionOf} ${this.getTraceDisplayName(shallowTrace)}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            type: "YesNo",
            confirmAction: () => {
                this.tracesService.deleteTrace(shallowTrace);
            },
        });
    }

    public editInOsm(shallowTrace: Immutable<Trace>) {
        window.open(this.osmAddressesService.getEditOsmGpxAddress(shallowTrace.id));
    }

    public async findUnmappedRoutes(shallowTrace: Immutable<Trace>): Promise<void> {
        try {
            const geoJson = await this.tracesService.getMissingParts(shallowTrace.id);
            if (geoJson.features.length === 0) {
                this.toastService.confirm({ message: this.resources.noUnmappedRoutes, type: "Ok" });
                this.missingParts = {
                    type: "FeatureCollection",
                    features: []
                };
                return;
            }
            this.missingParts = geoJson;
            const bounds = SpatialService.getBoundsForFeatureCollection(geoJson);
            this.mapService.fitBounds(bounds);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unexpectedErrorPleaseTryAgainLater);
        }
    }

    public async uploadToOsm(e: any) {
        const file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        try {
            await this.tracesService.uploadTrace(file);
            this.toastService.success(this.resources.fileUploadedSuccessfullyItWillTakeTime);
            this.tracesService.syncTraces();
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToUploadFile);
        }
    }

    private runFilter() {
        const searchTerm = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.searchTerm).trim();
        const traces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces;
        this.filteredTraces = orderBy(traces.filter((t) => this.findInTrace(t, searchTerm)), ["timeStamp"], ["desc"]);
        this.tracesGeoJson = {
            type: "FeatureCollection",
            features: this.filteredTraces.map(t => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [t.start.lng, t.start.lat],
                },
                properties: {
                    id: t.id,
                    name: this.getTraceDisplayName(t),
                    description: t.description,
                    timeStamp: t.timeStamp,
                },
            })),
        };
    }

    private findInTrace(trace: Immutable<Trace>, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        const lowerSearchTerm = searchTerm.toLowerCase();
        if ((trace.description || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((trace.name || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((trace.id || 0).toString().toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((trace.tagsString || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((new Date(trace.timeStamp).toISOString() || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        return false;
    }

    public isMobile(): boolean {
        return this.runningContextService.isMobile;
    }

    public canUploadToOsm(shallowTrace: Immutable<Trace>): boolean {
        return shallowTrace.visibility === "local";
    }

    public async uploadRecordingToOsm(trace: Immutable<Trace>) {
        const route = trace.dataContainer.routes[0];
        try {
            await this.tracesService.uploadRouteAsTrace(route);
            await this.tracesService.deleteTrace(trace);
            await this.tracesService.syncTraces();
            this.toastService.info(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToUploadFile);
        }
    }

    public getTraceDisplayName(trace: Immutable<Trace>) {
        return (trace.visibility === "local") ? trace.name : trace.description;
    }

    public getVisibilityTranslation(visibility: TraceVisibility) {
        switch (visibility) {
            case "private":
            case "trackable":
                return this.resources.private;
            case "public":
            case "identifiable":
                return this.resources.public;
            case "local":
                return this.resources.local;
            default:
                throw new Error(`invalid visibility value: ${visibility}`);
        }
    }

    public async moveToTrace(traceId: string) {
        const fullTrace = await this.tracesService.getTraceById(traceId);
        this.selectedTrace = fullTrace;
        const features: GeoJSON.Feature[] = [];
        for (const route of fullTrace.dataContainer.routes) {
            route.color = "magenta";
            route.weight = 10;
            route.opacity = 0.7;
            features.push(...this.selectedRouteService.createFeaturesForRoute(route));
        }
        this.selectedTraceGeoJson = { type: "FeatureCollection", features };
        const bounds = SpatialService.getBoundsForFeatureCollection(this.selectedTraceGeoJson);
        this.mapService.fitBounds(bounds);
    }

    public onStartPointClick(traceId: string, event?: Event) {
        event?.stopPropagation();
        if (this.selectedTrace?.id === traceId) {
            this.selectedTrace = null;
            this.selectedTraceGeoJson = { type: "FeatureCollection", features: [] };
            return;
        }
        this.moveToTrace(traceId);
        ScrollToDirective.scrollTo(`trace-${traceId}`, 60);
    }

    public expandCluster(feature: GeoJSON.Feature<GeoJSON.Point>, event: Event) {
        event.stopPropagation();
        this.mapService.flyTo({ lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] }, 15.1);
    }

    public getLatLngLikeForFeature(feautre: GeoJSON.Feature<GeoJSON.LineString>): GeoJSON.Position {
        return feautre.geometry.coordinates[0];
    }

    public setSelectedFeature(feature: GeoJSON.Feature<GeoJSON.LineString>, event: Event) {
        this.selectedFeature = feature;
        const coordinates = this.getLatLngLikeForFeature(this.selectedFeature);
        this.missingCoordinates = { lat: coordinates[1], lng: coordinates[0] };
        this.selectedFeatureSource = {
            type: "FeatureCollection",
            features: [this.selectedFeature]
        };
        event.stopPropagation();
    }

    public removeMissingPart() {
        this.missingParts = {
            type: "FeatureCollection",
            features: this.missingParts.features.filter(f => f !== this.selectedFeature)
        }
        this.clearSelection();
    }

    public clearSelection() {
        this.selectedFeature = null;
        this.missingCoordinates = null;
        this.selectedFeatureSource = {
            type: "FeatureCollection",
            features: []
        };
    }
}
