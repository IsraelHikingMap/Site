import {
    Component,
    Injector,
    ComponentFactoryResolver,
    OnInit,
    OnDestroy,
    ViewEncapsulation,
} from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef } from "@angular/material";
import { SharedStorage } from "ngx-store";
import { Subscription } from "rxjs";
//import * as _ from "lodash";
import { orderBy, take } from "lodash";

import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { OsmUserService } from "../../services/osm-user.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { ToastService } from "../../services/toast.service";
import { IconsService } from "../../services/icons.service";
import { DataContainerService } from "../../services/data-container.service";
import { LayersService } from "../../services/layers/layers.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { GeoJsonParser } from "../../services/geojson.parser";
import { BaseMapComponent } from "../base-map.component";
import { MissingPartMarkerPopupComponent } from "../markerpopup/missing-part-marker-popup.component";
import { ITrace, TracesService } from "../../services/traces.service";
import { DataContainer, IMarkerWithTitle, RouteData } from "../../models/models";
import { RunningContextService } from "../../services/running-context.service";


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
        private readonly injector: Injector,
        private readonly matDialogRef: MatDialogRef<TracesDialogComponent>,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly fileService: FileService,
        private readonly dataContainerService: DataContainerService,
        private readonly layersService: LayersService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly toastService: ToastService,
        private readonly geoJsonParser: GeoJsonParser,
        private readonly routesService: RoutesService,
        private readonly osmUserService: OsmUserService,
        private readonly tracesService: TracesService,
        private readonly runningContextService: RunningContextService
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
        let data = (trace.id === "")
            ? this.getDataContainerFromRecording(trace)
            : await this.fileService.openFromUrl(trace.dataUrl);

        this.layersService.readOnlyDataContainer = data;
        // HM TODO: fit bounds, set type?;
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
                    this.routesService.removeRouteFromLocalStorage(this.getRouteFromTrace(this.selectedTrace));
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
            // HM TODO: fit bounds of missing parts
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
        let localTraces = this.routesService.locallyRecordedRoutes.map((r) => {
            return {
                name: r.name,
                description: r.description,
                timeStamp: new Date(r.segments[0].latlngs[0].timestamp),
                id: "",
                visibility: "private"
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
        return this.selectedTrace != null && this.selectedTrace.id === "";
    }

    public async uploadRecordingToOsm() {
        let route = this.getRouteFromTrace(this.selectedTrace);
        try {
            await this.fileService.uploadRouteAsTrace(route);
            await this.tracesService.getTraces();
            this.routesService.removeRouteFromLocalStorage(route);
            this.selectedTrace = null;
            this.toastService.info(this.resources.fileUploadedSuccessfullyItWillTakeTime);
        } catch (ex) {
            this.toastService.error(this.resources.unableToUploadFile);
        }
    }

    private getRouteFromTrace(trace: ITrace): RouteData {
        return this.routesService.locallyRecordedRoutes.filter(r => r.name === trace.name)[0];
    }

    public hasNoTraces(): boolean {
        return this.tracesService.traces.length === 0 && !this.loadingTraces;
    }

    public getTraceDisplayName(trace: ITrace) {
        return (trace.id === "") ? trace.name : trace.description;
    }
}