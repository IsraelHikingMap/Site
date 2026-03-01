import { Component, OnInit, ViewEncapsulation, inject } from "@angular/core";
import { Router } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Dir } from "@angular/cdk/bidi";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { GeoJSONSourceComponent, LayerComponent, MapComponent, MarkerComponent, PopupComponent } from "@maplibre/ngx-maplibre-gl";
import { MatButton, MatAnchor } from "@angular/material/button";
import { DatePipe } from "@angular/common";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { orderBy } from "lodash-es";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { SecuredImageComponent } from "../secured-image.component";
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
import { SetVisibleTraceAction, SetMissingPartsAction } from "../../reducers/traces.reducer";
import type { ApplicationState, Trace, TraceVisibility } from "../../models";

@Component({
    selector: "traces",
    templateUrl: "./traces.component.html",
    styleUrls: ["./traces.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatButton, MatAnchor, Angulartics2OnModule, SecuredImageComponent, MatProgressSpinner, DatePipe, MatMenu, MatMenuTrigger, MatMenuItem, MapComponent, MarkerComponent, PopupComponent, GeoJSONSourceComponent, LayerComponent]
})
export class TracesComponent implements OnInit {

    public filteredTraces: Immutable<Trace[]>;
    public loadingTraces: boolean = false;
    public selectedTrace: Immutable<Trace> | undefined;
    public traceGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString> | undefined = {
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
    private readonly router = inject(Router);
    private readonly store = inject(Store);

    constructor() {
        this.store.select((s: ApplicationState) => s.inMemoryState.searchTerm).pipe(takeUntilDestroyed()).subscribe((searchTerm: string) => {
            this.runFilter();
        });
        this.store.select((state: ApplicationState) => state.tracesState.traces).pipe(takeUntilDestroyed()).subscribe(() => {
            if (!this.loadingTraces) {
                this.runFilter();
            }
        });
    }

    public async ngOnInit() {
        this.loadingTraces = true;
        await this.tracesService.syncTraces();
        this.loadingTraces = false;
        this.runFilter();
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
        // HM TODO: create edit dialog
        // open edit dialog   
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
                return;
            }
            const trace = await this.tracesService.getTraceById(shallowTrace.id);
            this.store.dispatch(new SetVisibleTraceAction(trace.id));
            this.store.dispatch(new SetMissingPartsAction(geoJson));
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
        let traces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces;
        this.filteredTraces = orderBy(traces.filter((t) => this.findInTrace(t, searchTerm)), ["timeStamp"], ["desc"]);
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

    public moveToTrace(trace: Immutable<Trace>) {
        // move the map to the trace
    }

    public onStartPointClick(trace: Immutable<Trace>) {
        this.selectedTrace = trace;
    }
}
