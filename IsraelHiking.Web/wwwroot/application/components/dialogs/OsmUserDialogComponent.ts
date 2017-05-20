import { Component, Injector, ComponentFactoryResolver, ApplicationRef, OnInit, OnDestroy } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Response } from "@angular/http";
import { MdDialogRef } from "@angular/material";
import { SessionStorageService } from "angular2-localstorage";
import { ResourcesService } from "../../services/ResourcesService";
import { MapService } from "../../services/MapService";
import { FileService } from "../../services/FileService";
import { OsmUserService, ITrace } from "../../services/OsmUserService";
import { FitBoundsService } from "../../services/FitBoundsService";
import { ToastService } from "../../services/ToastService";
import { IconsService } from "../../services/IconsService";
import { LayersService } from "../../services/layers/LayersService";
import { GeoJsonParser } from "../../services/GeoJsonParser";
import { BaseMapComponent } from "../BaseMapComponent";
import { SearchResultsMarkerPopupComponent } from "../markerpopup/SearchResultsMarkerPopupComponent";
import { MissingPartMarkerPopupComponent } from "../markerpopup/MissingPartMarkerPopupComponent";
import { Urls } from "../../common/Urls";
import { Subscription } from "rxjs/Subscription";
import * as _ from "lodash";
import * as Common from "../../common/IsraelHiking";
import * as $ from "jquery";

interface IRank {
    name: string;
    points: number;
}

interface IOsmUserDialogState {
    selectedTabIndex: number;
    searchTerm: string;
    scrollPosition: number;
}

@Component({
    selector: "osm-user-dialog",
    moduleId: module.id,
    templateUrl: "osmUserDialog.html",
    styleUrls: ["osmUserDialog.css"]
})
export class OsmUserDialogComponent extends BaseMapComponent implements OnInit, OnDestroy {
    private static OSM_USER_DIALOG_STATE_KEY = "OsmUserDialogState";

    public ranks: IRank[];
    public filteredSiteUrls: Common.SiteUrl[];
    public filteredTraces: ITrace[];
    public state: IOsmUserDialogState;

    public searchTerm: FormControl;

    private osmTraceLayer: L.LayerGroup;
    private languageChangeSubscription: Subscription;

    constructor(resources: ResourcesService,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef,
        private mapService: MapService,
        private userService: OsmUserService,
        private fileService: FileService,
        private layersService: LayersService,
        private fitBoundsService: FitBoundsService,
        private toastService: ToastService,
        private sessionStorageService: SessionStorageService,
        private mdDialogRef: MdDialogRef<OsmUserDialogComponent>,
    ) {
        super(resources);
        this.initializeRanks();
        this.osmTraceLayer = L.layerGroup([]);
        this.mapService.map.addLayer(this.osmTraceLayer);
        this.searchTerm = new FormControl();
        this.state = this.sessionStorageService.get(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY) || {
            scrollPosition: 0,
            searchTerm: "",
            selectedTabIndex: 0
        };
        this.searchTerm.valueChanges.subscribe((searchTerm: string) => {
            searchTerm = searchTerm.trim();
            this.state.searchTerm = searchTerm;
            this.sessionStorageService.set(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY, this.state);
            this.filteredSiteUrls = this.userService.siteUrls.filter((s) => this.findInObject(s, searchTerm));
            this.filteredTraces = _.orderBy(this.userService.traces.filter((t) => this.findInObject(t, searchTerm)), ["date"], ["dec"]);
        });
        this.searchTerm.setValue(this.state.searchTerm);
        

        this.languageChangeSubscription = this.resources.languageChanged.subscribe(this.initializeRanks);
        this.userService.refreshDetails();
    }

    public ngOnInit() {
        let dialogElement = $(".dialog-content-for-scroll");
        dialogElement.delay(700)
            .animate({
                scrollTop: this.state.scrollPosition
            },
            "slow");
        dialogElement.on("scroll", () => {
            this.state.scrollPosition = dialogElement.scrollTop();
            this.sessionStorageService.set(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY, this.state);
        });
    }

    public ngOnDestroy() {
        this.languageChangeSubscription.unsubscribe();
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

    public showTrace = (trace: ITrace): Promise<Response> => {
        let promise = this.fileService.openFromUrl(trace.dataUrl);
        promise.then((resposnse) => {
            let data = resposnse.json() as Common.DataContainer;
            this.osmTraceLayer.clearLayers();
            for (let route of data.routes) {
                for (let segment of route.segments) {
                    let polyLine = L.polyline(segment.latlngs, this.getPathOprtions());
                    this.osmTraceLayer.addLayer(polyLine);
                }
                for (let markerData of route.markers) {
                    let icon = IconsService.createPoiDefaultMarkerIcon(this.getPathOprtions().color);
                    let marker = L.marker(markerData.latlng, { draggable: false, clickable: false, keyboard: false, riseOnHover: true, icon: icon, opacity: this.getPathOprtions().opacity } as L.MarkerOptions) as Common.IMarkerWithTitle;
                    this.mapService.setMarkerTitle(marker, markerData.title);
                    this.osmTraceLayer.addLayer(marker);
                }
            }
            let bounds = L.latLngBounds(data.southWest, data.northEast);
            // marker to allow remove of this layer:
            let mainMarker = L.marker(bounds.getCenter(), { icon: IconsService.createTraceMarkerIcon(), draggable: false }) as Common.IMarkerWithTitle;
            mainMarker.title = trace.fileName;

            let markerPopupDiv = L.DomUtil.create("div");
            let factory = this.componentFactoryResolver.resolveComponentFactory(SearchResultsMarkerPopupComponent);
            let componentRef = factory.create(this.injector, null, markerPopupDiv);
            componentRef.instance.setMarker(mainMarker);
            componentRef.instance.remove = () => {
                this.osmTraceLayer.clearLayers();
            }
            componentRef.instance.convertToRoute = () => {
                this.layersService.setJsonData(data);
                this.osmTraceLayer.clearLayers();
            }
            this.applicationRef.attachView(componentRef.hostView);
            mainMarker.bindPopup(markerPopupDiv);
            this.osmTraceLayer.addLayer(mainMarker);
            this.fitBoundsService.fitBounds(bounds, { maxZoom: LayersService.MAX_NATIVE_ZOOM } as L.FitBoundsOptions);
        });
        return promise;
    }

    public editTrace(trace: ITrace) {
        this.fileService.openFromUrl(trace.dataUrl).then((response) => {
            this.layersService.setJsonData(response.json());
        });
    }

    public editInOsm(trace: ITrace) {
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        window.open(this.userService.getEditOsmGpxAddress(baseLayerAddress, trace.id));
    }

    public findUnmappedRoutes = (trace: ITrace): void => {
        this.userService.getMissingParts(trace)
            .then((response) => {
                let geoJson = response.json() as GeoJSON.FeatureCollection<GeoJSON.LineString>;
                if (geoJson.features.length === 0) {
                    this.toastService.success(this.resources.noUnmappedRoutes);
                    return;
                }
                this.showTrace(trace).then(() => {
                    this.addMissingPartsToMap(geoJson);
                    this.mdDialogRef.close();
                });
            });
    }

    public uploadToOsm(file: File) {
        if (!file) {
            return;
        }
        this.fileService.upload(Urls.osmUploadTrace, file).then(() => {
            this.toastService.success(this.resources.fileUploadedSuccefullyItWillTakeTime);
            this.userService.refreshDetails();
        }, () => {
            this.toastService.error(this.resources.unableToUploadFile);
        });
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
        var geoJsonLayer = L.geoJSON(geoJson);
        for (let feature of geoJson.features) {
            let lineString = feature.geometry as GeoJSON.LineString;
            let latLngs = GeoJsonParser.createLatlngArray(lineString.coordinates);
            let unselectedPathOptions = { color: "red", weight: 3, opacity: 1 } as L.PathOptions;
            let polyline = L.polyline(latLngs, unselectedPathOptions);
            this.osmTraceLayer.addLayer(polyline);
            let marker = L.marker(latLngs[0], { draggable: false, clickable: true, keyboard: false, icon: IconsService.createMissingPartMarkerIcon() } as L.MarkerOptions) as Common.IMarkerWithTitle;
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
            this.applicationRef.attachView(componentRef.hostView);

            marker.bindPopup(markerPopupDiv);
            marker.on("popupopen", () => { polyline.setStyle({ color: "DarkRed", weight: 5, opacity: 1 } as L.PathOptions); });
            marker.on("popupclose", () => { polyline.setStyle(unselectedPathOptions); });
            polyline.on("click", () => { marker.openPopup() });
            this.osmTraceLayer.addLayer(marker);
        }

        this.fitBoundsService.fitBounds(geoJsonLayer.getBounds());
    }

    private findInObject(object: Object, searchTerm: string) {
        if (!searchTerm)
        {
            return true;
        }
        return JSON.stringify(object).toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1;
    }

    public setSelectedTab() {
        this.sessionStorageService.set(OsmUserDialogComponent.OSM_USER_DIALOG_STATE_KEY, this.state);
    }
}