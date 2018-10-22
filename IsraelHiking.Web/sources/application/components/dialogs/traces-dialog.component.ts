import { Component, OnInit, OnDestroy, ViewEncapsulation } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef } from "@angular/material";
import { SharedStorage } from "ngx-store";
import { Subscription } from "rxjs";
import { orderBy, take } from "lodash";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { OsmUserService } from "../../services/osm-user.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { ToastService } from "../../services/toast.service";
import { LayersService } from "../../services/layers/layers.service";
import { BaseMapComponent } from "../base-map.component";
import { ITrace, TracesService, Visibility } from "../../services/traces.service";
import { RunningContextService } from "../../services/running-context.service";
import { RemoveLocallyRecordedRouteAction } from "../../reducres/locally-recorded-routes.reducer";
import { DataContainer, RouteData, ApplicationState } from "../../models/models";
import { SpatialService } from "../../services/spatial.service";

@Component({
    selector: "traces-dialog",
    templateUrl: "./traces-dialog.component.html",
    styleUrls: ["./traces-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class TracesDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {

    public filteredTraces: ITrace[];
    public selectedTrace: ITrace;
    public file: File;
    public loadingTraces: boolean;
    public searchTerm: FormControl;

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
        private readonly osmUserService: OsmUserService,
        private readonly tracesService: TracesService,
        private readonly runningContextService: RunningContextService,
        private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.loadingTraces = false;
        this.selectedTrace = null;
        this.page = 1;
        this.searchTerm = new FormControl();

        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.tracesChangedSubscription = this.tracesService.tracesChanged.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingTraces = false;
        });
    }

    public ngOnInit() {
        this.loadingTraces = true;
        this.tracesService.getTraces();
    }

    public ngOnDestroy() {
        this.tracesChangedSubscription.unsubscribe();
    }

    public showTrace = async (trace: ITrace): Promise<DataContainer> => {
        let data = (trace.visibility === "local")
            ? this.getDataContainerFromRecording(trace)
            : await this.fileService.openFromUrl(trace.dataUrl);

        // HM TODO: show trace should be in tracesService
        this.layersService.readOnlyDataContainer = data;
        // HM TODO: fit bounds, set popup type?;
        return data;
    }

    private getDataContainerFromRecording(trace) {
        let routeData = this.getRouteFromTrace(trace);
        let latLngs = routeData.segments[0].latlngs;
        let northEast = { lat: Math.max(...latLngs.map(l => l.lat)), lng: Math.max(...latLngs.map(l => l.lng)) };
        let southWest = { lat: Math.min(...latLngs.map(l => l.lat)), lng: Math.min(...latLngs.map(l => l.lng)) };
        return {
            routes: [routeData],
            northEast: northEast,
            southWest: southWest
        } as DataContainer;
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
                if (this.selectedTrace.id === "") {
                    this.ngRedux.dispatch(new RemoveLocallyRecordedRouteAction({
                        routeId: this.getRouteFromTrace(this.selectedTrace).id
                    }));
                    this.updateFilteredLists(this.searchTerm.value);
                } else {
                    this.tracesService.deleteTrace(this.selectedTrace);
                }
            },
        });
    }

    public editInOsm() {
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        window.open(this.osmUserService.getEditOsmGpxAddress(baseLayerAddress, this.selectedTrace.id));
    }

    public findUnmappedRoutes = async (trace: ITrace): Promise<void> => {
        try {
            let geoJson = await this.tracesService.getMissingParts(trace);
            if (geoJson.features.length === 0) {
                this.toastService.confirm({ message: this.resources.noUnmappedRoutes, type: "Ok" });
                return;
            }
            await this.showTrace(trace);
            this.tracesService.missingParts = geoJson;
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
            this.tracesService.getTraces();
        } catch (ex) {
            this.toastService.error(this.resources.unableToUploadFile);
        }
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.sessionSearchTerm = searchTerm;
        let localTraces = this.ngRedux.getState().locallyRecordedRoutes.map((r) => {
            return {
                name: r.name,
                description: r.description,
                timeStamp: new Date(r.segments[0].latlngs[0].timestamp),
                id: r.id,
                visibility: "local"
            } as ITrace;
        });
        let traces = this.tracesService.traces.concat(localTraces);
        let ordered = orderBy(traces.filter((t) => this.findInTrace(t, searchTerm)), ["timeStamp"], ["desc"]);
        this.filteredTraces = take(ordered, this.page * 10);
    }

    private findInTrace(trace: ITrace, searchTerm: string) {
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

    public toggleSelectedTrace(trace: ITrace) {
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
        let route = this.getRouteFromTrace(this.selectedTrace);
        this.selectedTrace = null;
        try {
            await this.fileService.uploadRouteAsTrace(route);
            await this.tracesService.getTraces();
            this.ngRedux.dispatch(new RemoveLocallyRecordedRouteAction({
                routeId: route.id
            }));
            this.toastService.info(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        } catch (ex) {
            this.toastService.error(this.resources.unableToUploadFile);
        }
    }

    private getRouteFromTrace(trace: ITrace): RouteData {
        return this.ngRedux.getState().locallyRecordedRoutes.filter(r => r.id === trace.id)[0];
    }

    public hasNoTraces(): boolean {
        return this.tracesService.traces.length === 0 && !this.loadingTraces;
    }

    public getTraceDisplayName(trace: ITrace) {
        return (trace.visibility === "local") ? trace.name : trace.description;
    }

    public getVisibilityTranslation(visibility: Visibility) {
        switch (visibility) {
            case "private":
                return this.resources.private;
            case "public":
                return this.resources.public;
            case "local":
                return this.resources.local;
            default:
                throw new Error(`invalid visibility value: ${visibility}`);
        }
    }
}