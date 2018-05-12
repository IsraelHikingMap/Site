import { Component, Injector, ComponentFactoryResolver, OnInit, OnDestroy, ViewChild, ElementRef, ViewEncapsulation, AfterViewInit } from "@angular/core";
import { FormControl } from "@angular/forms";
import { MatDialogRef } from "@angular/material";
import { SharedStorageService } from "ngx-store";
import { ScrollToService, ScrollToConfigOptions } from "@nicky-lenaers/ngx-scroll-to";
import { Subscription } from "rxjs/Subscription";
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
import { GeoJsonParser } from "../../services/geojson.parser";
import { BaseMapComponent } from "../base-map.component";
import { SearchResultsMarkerPopupComponent } from "../markerpopup/search-results-marker-popup.component";
import { MissingPartMarkerPopupComponent } from "../markerpopup/missing-part-marker-popup.component";
import * as Common from "../../common/IsraelHiking";

interface IRank {
    name: string;
    points: number;
}

interface IOsmUserDialogState {
    selectedTabIndex: number;
    searchTerm: string;
    scrollPosition: number;
    sharesPage: number;
    tracesPage: number;
}

@Component({
    selector: "osm-user-dialog",
    templateUrl: "./osm-user-dialog.component.html",
    styleUrls: ["./osm-user-dialog.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class OsmUserDialogComponent extends BaseMapComponent implements OnInit, OnDestroy, AfterViewInit {

    private static OSM_USER_DIALOG_STATE_KEY = "OsmUserDialogState";

    public ranks: IRank[];
    public filteredShareUrls: Common.ShareUrl[];
    public filteredTraces: ITrace[];
    public shareUrlInEditMode: Common.ShareUrl;
    public state: IOsmUserDialogState;
    public file: File;
    public loadingTraces: boolean;
    public loadingShareUrls: boolean;
    public searchTerm: FormControl;

    private osmTraceLayer: L.LayerGroup;
    private languageChangeSubscription: Subscription;
    private tracesChangedSubscription: Subscription;
    private shareUrlChangedSubscription: Subscription;

    @ViewChild("dialogContentForScroll") dialogContent: ElementRef;

    constructor(resources: ResourcesService,
        private readonly injector: Injector,
        private readonly sharedStorageService: SharedStorageService,
        private readonly matDialogRef: MatDialogRef<OsmUserDialogComponent>,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly mapService: MapService,
        private readonly fileService: FileService,
        private readonly dataContainerService: DataContainerService,
        private readonly layersService: LayersService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly toastService: ToastService,
        private readonly geoJsonParser: GeoJsonParser,
        private readonly scrollToService: ScrollToService,
        public readonly userService: OsmUserService,
    ) {
        super(resources);
        this.loadingTraces = false;
        this.loadingShareUrls = false;
        this.initializeRanks();
        this.osmTraceLayer = L.layerGroup([]);
        this.mapService.map.addLayer(this.osmTraceLayer);
        this.searchTerm = new FormControl();
        this.shareUrlInEditMode = null;
        this.state = this.sharedStorageService.get(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY) || {
            scrollPosition: 0,
            searchTerm: "",
            selectedTabIndex: 0,
            sharesPage: 1,
            tracesPage: 1
        };
        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            this.updateFilteredLists(searchTerm);
        });
        this.searchTerm.setValue(this.state.searchTerm);
        this.languageChangeSubscription = this.resources.languageChanged.subscribe(this.initializeRanks);
        this.tracesChangedSubscription = this.userService.tracesChanged.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingTraces = false;
        });
        this.shareUrlChangedSubscription = this.userService.shareUrlsChanged.subscribe(() => {
            this.updateFilteredLists(this.searchTerm.value);
            this.loadingShareUrls = false;
        });
    }

    public ngOnInit() {
        this.loadingTraces = true;
        this.loadingShareUrls = true;
        this.userService.refreshDetails();
        let dialogElement = this.dialogContent.nativeElement as HTMLElement;
        dialogElement.onscroll = () => {
            this.state.scrollPosition = dialogElement.scrollTop;
            this.sharedStorageService.set(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY, this.state);
        }
    }

    ngAfterViewInit(): void {
        let dialogElement = this.dialogContent.nativeElement as HTMLElement;
        this.scrollToService.scrollTo(
            {
                offset: this.state.scrollPosition,
                container: dialogElement
            } as ScrollToConfigOptions);
    }

    public ngOnDestroy() {
        this.languageChangeSubscription.unsubscribe();
        this.tracesChangedSubscription.unsubscribe();
        this.shareUrlChangedSubscription.unsubscribe();
    }

    public getRank() {
        let rankIndex = 0;
        while (this.userService.changeSets > this.ranks[rankIndex].points) {
            rankIndex++;
        }
        return this.ranks[rankIndex];
    }

    public getRankPercentage() {
        let rank = this.getRank();
        if (rank === this.ranks[this.ranks.length - 1]) {
            return 100;
        }
        return ((this.userService.changeSets / rank.points) * 100);
    }

    public getProgessbarType() {
        if (this.getRankPercentage() < 5) {
            return "Warn";
        }
        if (this.getRankPercentage() < 30) {
            return "Accent";
        }
        return "Primary";
    }

    public showTrace = (trace: ITrace): Promise<Common.DataContainer> => {
        let promise = this.fileService.openFromUrl(trace.dataUrl);
        promise.then((data) => {
            this.osmTraceLayer.clearLayers();
            for (let route of data.routes) {
                for (let segment of route.segments) {
                    let polyLine = L.polyline(segment.latlngs, this.getPathOprtions());
                    this.osmTraceLayer.addLayer(polyLine);
                }
                for (let markerData of route.markers) {
                    let icon = IconsService.createPoiDefaultMarkerIcon(this.getPathOprtions().color);
                    let marker = L.marker(markerData.latlng, { draggable: false, clickable: false, riseOnHover: true, icon: icon, opacity: this.getPathOprtions().opacity } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    this.mapService.setMarkerTitle(marker, markerData);
                    this.osmTraceLayer.addLayer(marker);
                }
            }
            let bounds = L.latLngBounds(data.southWest, data.northEast);
            // marker to allow remove of this layer:
            let mainMarker = L.marker(bounds.getCenter(), { icon: IconsService.createTraceMarkerIcon(), draggable: false }) as Common.IMarkerWithTitle;
            mainMarker.title = trace.name;

            let markerPopupDiv = L.DomUtil.create("div");
            let factory = this.componentFactoryResolver.resolveComponentFactory(SearchResultsMarkerPopupComponent);
            let componentRef = factory.create(this.injector, null, markerPopupDiv);
            componentRef.instance.setMarker(mainMarker);
            componentRef.instance.remove = () => {
                this.osmTraceLayer.clearLayers();
            }
            componentRef.instance.convertToRoute = () => {
                this.dataContainerService.setData(data);
                this.osmTraceLayer.clearLayers();
            }
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
        this.toastService.confirm(message, () => this.userService.deleteOsmTrace(trace), () => { }, true);
    }

    public editInOsm(trace: ITrace) {
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        window.open(this.userService.getEditOsmGpxAddress(baseLayerAddress, trace.id));
    }

    public findUnmappedRoutes = (trace: ITrace): void => {
        this.userService.getMissingParts(trace)
            .then((geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>) => {
                if (geoJson.features.length === 0) {
                    this.toastService.success(this.resources.noUnmappedRoutes);
                    return;
                }
                this.showTrace(trace).then(() => {
                    this.addMissingPartsToMap(geoJson);
                    this.matDialogRef.close();
                });
            });
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
        };
    }

    private updateFilteredLists(searchTerm: string) {
        searchTerm = searchTerm.trim();
        this.state.searchTerm = searchTerm;
        this.sharedStorageService.set(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY, this.state);
        this.filteredShareUrls = this.userService.shareUrls.filter((s) => this.findInShareUrl(s, searchTerm));
        this.filteredTraces = _.orderBy(this.userService.traces.filter((t) => this.findInTrace(t, searchTerm)), ["date"], ["desc"]);
    }

    private getPathOprtions = (): L.PathOptions => {
        return { opacity: 0.5, color: "blue", weight: 3 } as L.PathOptions;
    }

    private initializeRanks() {
        this.ranks = [
            {
                name: this.resources.junior,
                points: 10
            },
            {
                name: this.resources.partner,
                points: 100
            },
            {
                name: this.resources.master,
                points: 1000
            },
            {
                name: this.resources.guru,
                points: Infinity
            }
        ];
    }

    private addMissingPartsToMap = (geoJson: GeoJSON.FeatureCollection<GeoJSON.LineString>) => {
        let geoJsonLayer = L.geoJSON(geoJson);
        for (let feature of geoJson.features) {
            let latLngs = this.geoJsonParser.toLatLngsArray(feature)[0];
            let unselectedPathOptions = { color: "red", weight: 3, opacity: 1 } as L.PathOptions;
            let polyline = L.polyline(latLngs, unselectedPathOptions);
            this.osmTraceLayer.addLayer(polyline);
            let marker = L.marker(latLngs[0], { draggable: false, clickable: true, icon: IconsService.createMissingPartMarkerIcon() } as L.MarkerOptions) as Common.IMarkerWithTitle;
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
            }
            componentRef.instance.setFeature(feature);
            componentRef.instance.angularBinding(componentRef.hostView);

            marker.bindPopup(markerPopupDiv);
            marker.on("popupopen", () => { polyline.setStyle({ color: "DarkRed", weight: 5, opacity: 1 } as L.PathOptions); });
            marker.on("popupclose", () => { polyline.setStyle(unselectedPathOptions); });
            polyline.on("click", () => { marker.openPopup() });
            this.osmTraceLayer.addLayer(marker);
        }

        this.fitBoundsService.fitBounds(geoJsonLayer.getBounds());
    }

    private findInShareUrl(shareUrl: Common.ShareUrl, searchTerm: string) {
        if (!searchTerm) {
            return true;
        }
        let lowerSearchTerm = searchTerm.toLowerCase();
        if ((shareUrl.description || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.title || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        if ((shareUrl.id || "").toLowerCase().includes(lowerSearchTerm)) {
            return true;
        }
        return false;
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
        return false;
    }

    public setSelectedTab() {
        this.sharedStorageService.set(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY, this.state);
    }

    public deleteShareUrl(shareUrl: Common.ShareUrl) {
        if (this.shareUrlInEditMode === shareUrl) {
            this.shareUrlInEditMode = null;
        }
        let message = `${this.resources.deletionOf} ${this.userService.getShareUrlDisplayName(shareUrl)}, ${this.resources.areYouSure}`;
        this.toastService.confirm(message, () => this.userService.deleteShareUrl(shareUrl), () => { }, true);
    }

    public isShareUrlInEditMode(shareUrl: Common.ShareUrl) {
        return this.shareUrlInEditMode === shareUrl;
    }

    public async updateShareUrl(shareUrl: Common.ShareUrl) {
        this.shareUrlInEditMode = null;
        await this.userService.updateShareUrl(shareUrl);
        this.toastService.success(this.resources.dataUpdatedSuccefully);
    }

    public async convertShareUrlToRoute(shareUrl: Common.ShareUrl) {
        let shareUrlWithData = await this.userService.getShareUrl(shareUrl.id);
        this.dataContainerService.setData(shareUrlWithData.dataContainer);
    }
}