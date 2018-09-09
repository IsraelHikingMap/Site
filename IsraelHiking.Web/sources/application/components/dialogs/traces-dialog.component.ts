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
import * as L from "leaflet";
import * as _ from "lodash";

import { ResourcesService } from "../../services/resources.service";
import { MapService } from "../../services/map.service";
import { FileService } from "../../services/file.service";
import { OsmUserService, ITrace } from "../../services/osm-user.service";
import { FitBoundsService } from "../../services/fit-bounds.service";
import { ToastService } from "../../services/toast.service";
import { IconsService } from "../../services/icons.service";
import { DataContainerService } from "../../services/data-container.service";
import { LayersService } from "../../services/layers/layers.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { GeoJsonParser } from "../../services/geojson.parser";
import { BaseMapComponent } from "../base-map.component";
import { SearchResultsMarkerPopupComponent } from "../markerpopup/search-results-marker-popup.component";
import { MissingPartMarkerPopupComponent } from "../markerpopup/missing-part-marker-popup.component";
import * as Common from "../../common/IsraelHiking";

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
    private osmTraceLayer: L.LayerGroup;
    private tracesChangedSubscription: Subscription;

    constructor(resources: ResourcesService,
        private readonly injector: Injector,
        private readonly matDialogRef: MatDialogRef<TracesDialogComponent>,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly mapService: MapService,
        private readonly fileService: FileService,
        private readonly dataContainerService: DataContainerService,
        private readonly layersService: LayersService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly toastService: ToastService,
        private readonly geoJsonParser: GeoJsonParser,
        private readonly routesService: RoutesService,
        private readonly userService: OsmUserService,
    ) {
        super(resources);
        this.loadingTraces = false;
        this.selectedTrace = null;
        this.page = 1;
        this.osmTraceLayer = L.layerGroup([]);
        this.mapService.map.addLayer(this.osmTraceLayer);
        this.searchTerm = new FormControl();

        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.sessionSearchTerm);
        this.tracesChangedSubscription = this.userService.tracesChanged.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingTraces = false;
        });
    }

    public ngOnInit() {
        this.loadingTraces = true;
        this.userService.refreshDetails();
    }

    public ngOnDestroy() {
        this.tracesChangedSubscription.unsubscribe();
    }

    public showTrace = (trace: ITrace): Promise<Common.DataContainer> => {
        let promise = this.fileService.openFromUrl(trace.dataUrl);
        promise.then((data) => {
            this.osmTraceLayer.clearLayers();
            for (let route of data.routes) {
                for (let segment of route.segments) {
                    let polyLine = L.polyline(segment.latlngs, this.getPathOptions());
                    this.osmTraceLayer.addLayer(polyLine);
                }
                for (let markerData of route.markers) {
                    let icon = IconsService.createPoiDefaultMarkerIcon(this.getPathOptions().color);
                    let marker = L.marker(markerData.latlng,
                        {
                            draggable: false,
                            clickable: false,
                            riseOnHover: true,
                            icon: icon,
                            opacity: this.getPathOptions().opacity
                        } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    this.mapService.setMarkerTitle(marker, markerData);
                    this.osmTraceLayer.addLayer(marker);
                }
            }
            let bounds = L.latLngBounds(data.southWest, data.northEast);
            // marker to allow remove of this layer:
            let mainMarker = L.marker(bounds.getCenter(),
                {
                    icon: IconsService.createTraceMarkerIcon(),
                    draggable: false
                }) as Common.IMarkerWithTitle;
            mainMarker.title = trace.name;

            let markerPopupDiv = L.DomUtil.create("div");
            let factory = this.componentFactoryResolver.resolveComponentFactory(SearchResultsMarkerPopupComponent);
            let componentRef = factory.create(this.injector, null, markerPopupDiv);
            componentRef.instance.setMarker(mainMarker);
            componentRef.instance.remove = () => {
                this.osmTraceLayer.clearLayers();
            };
            componentRef.instance.convertToRoute = () => {
                this.dataContainerService.setData(data);
                this.osmTraceLayer.clearLayers();
            };
            componentRef.instance.angularBinding(componentRef.hostView);
            mainMarker.bindPopup(markerPopupDiv);
            this.osmTraceLayer.addLayer(mainMarker);
            this.fitBoundsService.fitBounds(bounds, { maxZoom: FitBoundsService.DEFAULT_MAX_ZOOM } as L.FitBoundsOptions);
        });
        return promise;
    }

    public editTrace(trace: ITrace) {
        trace.isInEditMode = true;
    }

    public updateTrace(trace: ITrace) {
        trace.isInEditMode = false;
        this.userService.updateOsmTrace(trace);
    }

    public deleteTrace(trace: ITrace) {
        trace.isInEditMode = false;
        let message = `${this.resources.deletionOf} ${trace.name}, ${this.resources.areYouSure}`;
        this.toastService.confirm(message, () => this.userService.deleteOsmTrace(trace), () => { }, "YesNo");
    }

    public editInOsm(trace: ITrace) {
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        window.open(this.userService.getEditOsmGpxAddress(baseLayerAddress, trace.id));
    }

    public findUnmappedRoutes = async (trace: ITrace): Promise<void> => {
        try {
            let geoJson = await this.userService.getMissingParts(trace);
            if (geoJson.features.length === 0) {
                this.toastService.confirm(this.resources.noUnmappedRoutes, () => { }, () => { }, "Ok");
                return;
            }
            this.showTrace(trace).then(() => {
                this.addMissingPartsToMap(geoJson);
                this.matDialogRef.close();
            });
        } catch (ex) {
            this.toastService.confirm(ex.message, () => {}, () => {}, "Ok");
        }
    }

    public async uploadToOsm(e: any) {

        let file = this.fileService.getFileFromEvent(e);
        if (!file) {
            return;
        }
        try {
            await this.fileService.uploadTrace(file);
            this.toastService.success(this.resources.fileUploadedSuccefullyItWillTakeTime);
            this.userService.refreshDetails();
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
                timeStamp: r.segments[0].latlngs[0].timestamp,
                id: "",
                visibility: "private"
            } as ITrace;
        });
        let traces = this.userService.traces.concat(localTraces);
        let ordered = _.orderBy(traces.filter((t) => this.findInTrace(t, searchTerm)), ["timeStamp"], ["desc"]);
        this.filteredTraces = _.take(ordered, this.page * 10);
    }

    private getPathOptions = (): L.PathOptions => {
        return { opacity: 0.5, color: "blue", weight: 3 } as L.PathOptions;
    }

    private addMissingPartsToMap = (geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>) => {
        let geoJsonLayer = L.geoJSON(geoJson);
        for (let feature of geoJson.features) {
            let latLngs = this.geoJsonParser.toLatLngsArray(feature)[0];
            let unselectedPathOptions = { color: "red", weight: 3, opacity: 1 } as L.PathOptions;
            let polyline = L.polyline(latLngs, unselectedPathOptions);
            this.osmTraceLayer.addLayer(polyline);
            let marker = L.marker(latLngs[0],
                {
                    draggable: false,
                    clickable: true,
                    icon: IconsService.createMissingPartMarkerIcon()
                } as L.MarkerOptions) as Common.IMarkerWithTitle;
            let markerPopupDiv = L.DomUtil.create("div");
            let factory = this.componentFactoryResolver.resolveComponentFactory(MissingPartMarkerPopupComponent);
            let componentRef = factory.create(this.injector, null, markerPopupDiv);
            componentRef.instance.setMarker(marker);
            componentRef.instance.remove = () => {
                marker.closePopup();
                marker.off("popupopen");
                marker.off("popupclose");
                polyline.off("click");
                this.osmTraceLayer.removeLayer(polyline);
                this.osmTraceLayer.removeLayer(marker);
            };
            componentRef.instance.setFeature(feature);
            componentRef.instance.angularBinding(componentRef.hostView);

            marker.bindPopup(markerPopupDiv);
            marker.on("popupopen", () => { polyline.setStyle({ color: "DarkRed", weight: 5, opacity: 1 } as L.PathOptions); });
            marker.on("popupclose", () => { polyline.setStyle(unselectedPathOptions); });
            polyline.on("click", () => { marker.openPopup(); });
            this.osmTraceLayer.addLayer(marker);
        }

        this.fitBoundsService.fitBounds(geoJsonLayer.getBounds());
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
        return L.Browser.mobile;
    }

    public canUploadToOsm(): boolean {
        return this.selectedTrace != null && this.selectedTrace.id === "";
    }

    public async uploadRecordingToOsm() {
        let route = this.routesService.locallyRecordedRoutes.filter(r => r.name === this.selectedTrace.name)[0];
        await this.fileService.uploadRouteAsTrace(route);
        this.userService.refreshDetails();
        // HM TODO: remove from the local routes list?
    }
}