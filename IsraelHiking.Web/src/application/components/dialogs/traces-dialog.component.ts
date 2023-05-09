import { Component, OnInit, OnDestroy, ViewEncapsulation, Inject } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Subscription, Observable } from "rxjs";
import { orderBy, take } from "lodash-es";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { AuthorizationService } from "../../services/authorization.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { ToastService } from "../../services/toast.service";
import { LayersService } from "../../services/layers.service";
import { TracesService } from "../../services/traces.service";
import { RunningContextService } from "../../services/running-context.service";
import { SpatialService } from "../../services/spatial.service";
import { DataContainerService } from "../../services/data-container.service";
import { SetVisibleTraceAction, SetMissingPartsAction } from "../../reducers/traces.reducer";
import type { ApplicationState, Trace, TraceVisibility } from "../../models/models";

@Component({
    selector: "traces-dialog",
    templateUrl: "./traces-dialog.component.html",
    styleUrls: ["./traces-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class TracesDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public filteredTraces: Trace[];
    public selectedTraceId: string;
    public traceIdInEditMode: string;
    public file: File;
    public loadingTraces: boolean;
    public searchTerm: FormControl<string>;

    @Select((state: ApplicationState) => state.tracesState.traces)
    public traces$: Observable<Trace[]>;

    private sessionSearchTerm = "";
    private page: number;
    private tracesChangedSubscription: Subscription;
    private specificIds: string[];

    constructor(resources: ResourcesService,
                private readonly matDialogRef: MatDialogRef<TracesDialogComponent>,
                private readonly fileService: FileService,
                private readonly layersService: LayersService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly toastService: ToastService,
                private readonly authorizationService: AuthorizationService,
                private readonly tracesService: TracesService,
                private readonly runningContextService: RunningContextService,
                private readonly dataContainerService: DataContainerService,
                private readonly store: Store,
                @Inject(MAT_DIALOG_DATA) data: string[]
    ) {
        super(resources);
        this.loadingTraces = false;
        this.selectedTraceId = null;
        this.traceIdInEditMode = null;
        this.page = 1;
        this.searchTerm = new FormControl<string>("");
        if (data) {
            this.specificIds = data;
        } else {
            this.specificIds = [];
        }

        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.tracesChangedSubscription = this.traces$.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
        });
    }

    public async ngOnInit() {
        this.loadingTraces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.length === 0;
        await this.tracesService.syncTraces();
        this.loadingTraces = false;
    }

    public ngOnDestroy() {
        this.tracesChangedSubscription.unsubscribe();
    }

    public async addTraceToRoutes() {
        let trace = await this.tracesService.getTraceById(this.selectedTraceId);
        this.dataContainerService.setData(trace.dataContainer, true);
    }

    private getSelectedTrace(): Trace {
        return this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.find(t => t.id === this.selectedTraceId);
    }

    public updateTrace() {
        this.traceIdInEditMode = null;
        this.tracesService.updateTrace(this.getSelectedTrace());
    }

    public deleteTrace() {
        if (this.traceIdInEditMode === this.selectedTraceId) {
            this.traceIdInEditMode = null;
        }
        let message = `${this.resources.deletionOf} ${this.getTraceDisplayName(this.getSelectedTrace())}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            type: "YesNo",
            confirmAction: () => {
                this.tracesService.deleteTrace(this.getSelectedTrace());
            },
        });
    }

    public editInOsm() {
        let baseLayerAddress = this.layersService.getSelectedBaseLayerAddressForOSM();
        window.open(this.authorizationService.getEditOsmGpxAddress(baseLayerAddress, this.selectedTraceId));
    }

    public async findUnmappedRoutes(): Promise<void> {
        try {
            let geoJson = await this.tracesService.getMissingParts(this.selectedTraceId);
            if (geoJson.features.length === 0) {
                this.toastService.confirm({ message: this.resources.noUnmappedRoutes, type: "Ok" });
                return;
            }
            let trace = await this.tracesService.getTraceById(this.selectedTraceId);
            this.store.dispatch(new SetVisibleTraceAction(trace.id));
            this.store.dispatch(new SetMissingPartsAction(geoJson));
            let bounds = SpatialService.getBoundsForFeatureCollection(geoJson);
            this.fitBoundsService.fitBounds(bounds);
            this.matDialogRef.close();
        } catch (ex) {
            this.toastService.error(ex, this.resources.unexpectedErrorPleaseTryAgainLater);
        }
    }

    public async uploadToOsm(e: any) {
        let file = this.fileService.getFileFromEvent(e);
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

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let traces = this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces;
        traces = orderBy(traces.filter((t) => this.findInTrace(t, searchTerm)), ["timeStamp"], ["desc"]);
        if (this.specificIds.length > 0) {
            traces = traces.filter(t => this.specificIds.find(id => id === t.id) != null);
        }
        this.filteredTraces = take(traces, this.page * 10);
    }

    private findInTrace(trace: Trace, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        let lowerSearchTerm = searchTerm.toLowerCase();
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

    public toggleSelectedTrace(trace: Trace) {
        if (this.selectedTraceId == null) {
            this.selectedTraceId = trace.id;
        } else if (this.selectedTraceId === trace.id && this.traceIdInEditMode !== trace.id) {
            this.selectedTraceId = null;
        } else {
            this.selectedTraceId = trace.id;
        }
    }

    public isTraceInEditMode(traceId: string) {
        return this.traceIdInEditMode === traceId && this.filteredTraces.find(t => t.id === traceId);
    }

    public hasSelected() {
        return this.selectedTraceId != null && this.filteredTraces.find(t => t.id === this.selectedTraceId);
    }

    public onScrollDown() {
        this.page++;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public isMobile(): boolean {
        return this.runningContextService.isMobile;
    }

    public canUploadToOsm(): boolean {
        return this.selectedTraceId != null && this.getSelectedTrace().visibility === "local";
    }

    public async uploadRecordingToOsm() {
        let trace = this.getSelectedTrace();
        let route = trace.dataContainer.routes[0];
        this.selectedTraceId = null;
        try {
            await this.tracesService.uploadRouteAsTrace(route);
            await this.tracesService.deleteTrace(trace);
            await this.tracesService.syncTraces();
            this.toastService.info(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToUploadFile);
        }
    }

    public hasNoTraces(): boolean {
        return !this.loadingTraces && this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.length === 0;
    }

    public getTraceDisplayName(trace: Trace) {
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
}
