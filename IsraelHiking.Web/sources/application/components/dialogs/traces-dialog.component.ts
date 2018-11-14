import { Component, OnInit, OnDestroy, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef } from "@angular/material";
import { SharedStorage } from "ngx-store";
import { Subscription, Observable } from "rxjs";
import { orderBy, take } from "lodash";
import { NgRedux, select } from "@angular-redux/store";

import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { AuthorizationService } from "../../services/authorization.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { ToastService } from "../../services/toast.service";
import { LayersService } from "../../services/layers/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { TracesService } from "../../services/traces.service";
import { RunningContextService } from "../../services/running-context.service";
import { DataContainer, ApplicationState, Trace, TraceVisibility } from "../../models/models";
import { SpatialService } from "../../services/spatial.service";
import { SetVisibleTraceAction, SetMissingPartsAction } from "../../reducres/traces.reducer";

@Component({
    selector: "traces-dialog",
    templateUrl: "./traces-dialog.component.html",
    styleUrls: ["./traces-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class TracesDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public filteredTraces: Trace[];
    public selectedTrace: Trace;
    public file: File;
    public loadingTraces: boolean;
    public searchTerm: FormControl;

    @select((state: ApplicationState) => state.tracesState.traces)
    public traces$: Observable<Trace[]>;
    private traces: Trace[];


    @SharedStorage()
    private sessionSearchTerm = "";

    private page: number;
    private tracesChangedSubscription: Subscription;

    constructor(resources: ResourcesService,
        private readonly matDialogRef: MatDialogRef<TracesDialogComponent>,
        private readonly fileService: FileService,
        private readonly layersService: LayersService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly toastService: ToastService,
        private readonly authorizationService: AuthorizationService,
        private readonly tracesService: TracesService,
        private readonly runningContextService: RunningContextService,
        private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.loadingTraces = false;
        this.selectedTrace = null;
        this.page = 1;
        this.traces = [];
        this.searchTerm = new FormControl();

        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.tracesChangedSubscription = this.traces$.subscribe((traces) => {
            this.traces = traces;
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingTraces = false;
        });
    }

    public ngOnInit() {
        this.loadingTraces = true;
        this.tracesService.syncTraces();
    }

    public ngOnDestroy() {
        this.tracesChangedSubscription.unsubscribe();
    }

    public showTrace = async (trace: Trace): Promise<DataContainer> => {

        if (trace.dataContainer == null && trace.dataUrl != null) {
            trace.dataContainer = await await this.fileService.openFromUrl(trace.dataUrl);
        }

        this.ngRedux.dispatch(new SetVisibleTraceAction({ traceId: trace.id }));
        let latlngs = [];
        for (let route of trace.dataContainer.routes) {
            for (let segment of route.segments) {
                latlngs = latlngs.concat(segment.latlngs);
            }
            for (let marker of route.markers) {
                latlngs.push(marker.latlng);
            }
        }
        let bounds = SpatialService.getBounds(latlngs);
        this.fitBoundsService.fitBounds(bounds);
        return trace.dataContainer;
    }

    public editTrace() {
        this.selectedTrace.isInEditMode = true;
    }

    public updateTrace() {
        this.selectedTrace.isInEditMode = false;
        this.tracesService.updateTrace(this.selectedTrace);
    }

    public deleteTrace() {
        this.selectedTrace.isInEditMode = false;
        let message = `${this.resources.deletionOf} ${this.selectedTrace.name}, ${this.resources.areYouSure}`;
        this.toastService.confirm({
            message: message,
            type: "YesNo",
            confirmAction: () => {
                this.tracesService.deleteTrace(this.selectedTrace);
            },
        });
    }

    public editInOsm() {
        let baseLayerAddress = this.layersService.getSelectedBaseLayer().address;
        window.open(this.authorizationService.getEditOsmGpxAddress(baseLayerAddress, this.selectedTrace.id));
    }

    public findUnmappedRoutes = async (trace: Trace): Promise<void> => {
        try {
            let geoJson = await this.tracesService.getMissingParts(trace);
            if (geoJson.features.length === 0) {
                this.toastService.confirm({ message: this.resources.noUnmappedRoutes, type: "Ok" });
                return;
            }
            await this.showTrace(trace);
            this.ngRedux.dispatch(new SetMissingPartsAction({ missingParts: geoJson }));
            let bounds = SpatialService.getGeoJsonBounds(geoJson);
            this.fitBoundsService.fitBounds(bounds);
            this.matDialogRef.close();
        } catch (ex) {
            this.toastService.confirm({ message: ex.message, type: "Ok" });
        }
    }

    public async uploadToOsm(e: any) {

        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        try {
            await this.fileService.uploadTrace(file);
            this.toastService.success(this.resources.fileUploadedSuccessfullyItWillTakeTime);
            this.tracesService.syncTraces();
        } catch (ex) {
            this.toastService.error(this.resources.unableToUploadFile);
        }
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let ordered = orderBy(this.traces.filter((t) => this.findInTrace(t, searchTerm)), ["timeStamp"], ["desc"]);
        this.filteredTraces = take(ordered, this.page * 10);
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
        if ((trace.tags || []).filter(t => t.toLowerCase().includes(lowerSearchTerm)).length > 0) {
            return true;
        }
        return false;
    }

    public toggleSelectedTrace(trace: Trace) {
        if (this.selectedTrace === trace && this.selectedTrace.isInEditMode) {
            return;
        }
        if (this.selectedTrace === trace) {
            this.selectedTrace = null;
        } else {
            this.selectedTrace = trace;
        }
    }

    public isTraceInEditMode() {
        return this.selectedTrace != null && this.selectedTrace.isInEditMode && this.filteredTraces.indexOf(this.selectedTrace) !== -1;
    }

    public hasSelected() {
        return this.selectedTrace != null && this.filteredTraces.indexOf(this.selectedTrace) !== -1;
    }

    public onScrollDown() {
        this.page++;
        this.updateFilteredLists(this.searchTerm.value);
    }

    public isMobile(): boolean {
        return this.runningContextService.isMobile;
    }

    public canUploadToOsm(): boolean {
        return this.selectedTrace != null && this.selectedTrace.visibility === "local";
    }

    public async uploadRecordingToOsm() {
        let route = this.selectedTrace.dataContainer.routes[0];
        this.selectedTrace = null;
        try {
            await this.fileService.uploadRouteAsTrace(route);
            await this.tracesService.syncTraces();
            this.toastService.info(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        } catch (ex) {
            this.toastService.error(this.resources.unableToUploadFile);
        }
    }

    public hasNoTraces(): boolean {
        return this.traces.length === 0 && !this.loadingTraces;
    }

    public getTraceDisplayName(trace: Trace) {
        return (trace.visibility === "local") ? trace.name : trace.description;
    }

    public getVisibilityTranslation(visibility: TraceVisibility) {
        switch (visibility) {
            case "private":
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