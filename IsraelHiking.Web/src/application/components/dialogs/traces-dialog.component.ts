import { Component, OnInit, ViewEncapsulation, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Dir } from "@angular/cdk/bidi";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatButton, MatAnchor } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { NgClass, DatePipe } from "@angular/common";
import { MatSelect } from "@angular/material/select";
import { MatOption } from "@angular/material/core";
import { MatProgressSpinner } from "@angular/material/progress-spinner";
import { MatTooltip } from "@angular/material/tooltip";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { InfiniteScrollDirective } from "ngx-infinite-scroll";
import { orderBy, take } from "lodash-es";
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
import { SetVisibleTraceAction, SetMissingPartsAction } from "../../reducers/traces.reducer";
import type { ApplicationState, Trace, TraceVisibility } from "../../models";

@Component({
    selector: "traces-dialog",
    templateUrl: "./traces-dialog.component.html",
    styleUrls: ["./traces-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [InfiniteScrollDirective, Dir, MatDialogTitle, MatFormField, MatLabel, MatInput, FormsModule, ReactiveFormsModule, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatAnchor, Angulartics2OnModule, NgClass, SecuredImageComponent, MatSelect, MatOption, MatProgressSpinner, MatDialogActions, MatTooltip, DatePipe]
})
export class TracesDialogComponent implements OnInit {

    public filteredTraces: Immutable<Trace[]>;
    public selectedTraceId: string = null;
    public traceInEditMode: Trace = null;
    public file: File;
    public loadingTraces: boolean = false;
    public searchTerm = new FormControl<string>("");

    private sessionSearchTerm = "";
    private page: number = 1;
    private specificIds: string[] = [];

    public readonly resources = inject(ResourcesService);

    private readonly matDialogRef = inject(MatDialogRef);
    private readonly fileService = inject(FileService);
    private readonly mapService = inject(MapService);
    private readonly toastService = inject(ToastService);
    private readonly osmAddressesService = inject(OsmAddressesService);
    private readonly tracesService = inject(TracesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly store = inject(Store);
    private readonly data = inject<string[]>(MAT_DIALOG_DATA);

    constructor() {
        this.specificIds = this.data;
        this.searchTerm.valueChanges.pipe(takeUntilDestroyed()).subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.store.select((state: ApplicationState) => state.tracesState.traces).pipe(takeUntilDestroyed()).subscribe(() => {
            if (!this.loadingTraces) {
                this.updateFilteredLists(this.searchTerm.value);
            }
        });
    }

    public async ngOnInit() {
        this.loadingTraces = true;
        await this.tracesService.syncTraces();
        this.loadingTraces = false;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public async addTraceToRoutes() {
        const trace = await this.tracesService.getTraceById(this.selectedTraceId);
        if (trace.dataContainer.routes.length === 1) {
            trace.dataContainer.routes[0].name = this.getTraceDisplayName(trace) || trace.name;
            trace.dataContainer.routes[0].description = trace.name;
        }
        this.dataContainerService.setData(trace.dataContainer, true);
    }

    private getSelectedTrace(): Immutable<Trace> {
        return this.store.selectSnapshot((s: ApplicationState) => s.tracesState).traces.find(t => t.id === this.selectedTraceId);
    }

    public async updateTrace() {
        await this.tracesService.updateTrace(this.traceInEditMode);
        this.traceInEditMode = null;
        this.toastService.success(this.resources.dataUpdatedSuccessfully);
    }

    public deleteTrace() {
        if (this.traceInEditMode?.id === this.selectedTraceId) {
            this.traceInEditMode = null;
        }
        const message = `${this.resources.deletionOf} ${this.getTraceDisplayName(this.getSelectedTrace())}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message,
            type: "YesNo",
            confirmAction: () => {
                this.tracesService.deleteTrace(this.getSelectedTrace());
            },
        });
    }

    public editInOsm() {
        window.open(this.osmAddressesService.getEditOsmGpxAddress(this.selectedTraceId));
    }

    public async findUnmappedRoutes(): Promise<void> {
        try {
            const geoJson = await this.tracesService.getMissingParts(this.selectedTraceId);
            if (geoJson.features.length === 0) {
                this.toastService.confirm({ message: this.resources.noUnmappedRoutes, type: "Ok" });
                return;
            }
            const trace = await this.tracesService.getTraceById(this.selectedTraceId);
            this.store.dispatch(new SetVisibleTraceAction(trace.id));
            this.store.dispatch(new SetMissingPartsAction(geoJson));
            const bounds = SpatialService.getBoundsForFeatureCollection(geoJson);
            this.mapService.fitBounds(bounds);
            this.matDialogRef.close();
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

    public toggleSelectedTrace(trace: Immutable<Trace>) {
        if (this.selectedTraceId == null) {
            this.selectedTraceId = trace.id;
        } else if (this.selectedTraceId === trace.id && this.traceInEditMode?.id !== trace.id) {
            this.selectedTraceId = null;
        } else {
            this.selectedTraceId = trace.id;
        }
    }

    public setTraceInEditMode() {
        this.traceInEditMode = structuredClone(this.getSelectedTrace()) as Trace;
    }

    public isTraceInEditMode(traceId: string) {
        return this.traceInEditMode?.id === traceId && this.filteredTraces.find(t => t.id === traceId);
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
        const trace = this.getSelectedTrace();
        const route = trace.dataContainer.routes[0];
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
}
