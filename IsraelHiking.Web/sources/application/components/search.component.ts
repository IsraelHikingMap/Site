import { Component, Injector, ComponentFactoryResolver, HostListener, ViewEncapsulation, AfterViewInit, ViewChild, ElementRef } from "@angular/core";
import { FormControl } from "@angular/forms";
import { Http } from "@angular/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { MapService } from "../services/map.service";
import { ResourcesService } from "../services/resources.service";
import { HashService } from "../services/hash.service";
import { LayersService } from "../services/layers/layers.service";
import { DataContainerService } from "../services/data-container.service";
import { ElevationProvider } from "../services/elevation.provider";
import { RouterService } from "../services/routers/router.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { IconsService } from "../services/icons.service";
import { ToastService } from "../services/toast.service";
import { SearchResultsProvider, ISearchResults } from "../services/search-results.provider";
import { BaseMapComponent } from "./base-map.component";
import { SearchResultsMarkerPopupComponent } from "./markerpopup/search-results-marker-popup.component";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export interface ISearchContext {
    searchTerm: string;
    searchResults: ISearchResults[];
    selectedSearchResults: ISearchResults;
}

interface ISearchRequestQueueItem {
    searchTerm: string;
}

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class SearchComponent extends BaseMapComponent implements AfterViewInit {

    public isVisible: boolean;
    public isDirectional: boolean;
    public fromContext: ISearchContext;
    public toContext: ISearchContext;
    public routingType: Common.RoutingType;
    public searchFrom: FormControl;
    public searchTo: FormControl;
    private requestsQueue: ISearchRequestQueueItem[];
    private featureGroup: L.FeatureGroup;

    @ViewChild("searchFromInput") searchFromInput: ElementRef;

    constructor(resources: ResourcesService,
        private http: Http,
        private mapService: MapService,
        private hashService: HashService,
        private dataContainerService: DataContainerService,
        private elevationProvider: ElevationProvider,
        private searchResultsProvider: SearchResultsProvider,
        private routerService: RouterService,
        private fitBoundsService: FitBoundsService,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private toastService: ToastService,
    ) {
        super(resources);
        this.requestsQueue = [];
        this.featureGroup = L.featureGroup();
        this.mapService.map.addLayer(this.featureGroup);
        this.isVisible = false;
        this.isDirectional = false;
        this.routingType = "Hike";
        this.fromContext = {
            searchTerm: hashService.searchTerm || "",
            searchResults: [],
            selectedSearchResults: null
        } as ISearchContext;
        this.toContext = {
            searchTerm: "",
            searchResults: [],
            selectedSearchResults: null
        } as ISearchContext;
        this.isVisible = this.fromContext.searchTerm ? true : false;
        this.searchFrom = new FormControl({ displayName: this.fromContext.searchTerm } as ISearchResults);
        this.searchTo = new FormControl();
        this.searchFrom.valueChanges.subscribe((x) => {
            if (typeof x === "string") {
                this.fromContext.searchTerm = x;
                this.fromContext.selectedSearchResults = null;
                this.search(this.fromContext);
            }
            else {
                this.selectResults(this.fromContext, x);
            }
        });
        this.searchTo.valueChanges.subscribe((x) => {
            if (typeof x === "string") {
                this.toContext.searchTerm = x;
                this.toContext.selectedSearchResults = null;
                this.search(this.toContext);
            }
            else {
                this.selectResults(this.toContext, x);
            }
        });

        if (this.isVisible) {
            this.search(this.fromContext);
        }
    }

    public ngAfterViewInit() {
        if (this.isVisible) {
            this.searchFromInput.nativeElement.focus();
        }
    }

    public toggleVisibility = (e: Event) => {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            // allow DOM make the input visible
            setTimeout(() => this.searchFromInput.nativeElement.focus(), 100);
        }
        this.suppressEvents(e);
    }

    public toggleDirectional = (e: Event) => {
        this.isDirectional = !this.isDirectional;
        this.suppressEvents(e);
    }

    public search = (searchContext: ISearchContext) => {
        if (searchContext.searchTerm.length <= 2) {
            searchContext.searchResults = [];
            return;
        }
        this.internalSearch(searchContext);
    }

    public displayResults(results: ISearchResults) {
        return results ? results.displayName : "";
    }

    public moveToResults = (searchResults: ISearchResults, e: Event) => {
        this.toggleVisibility(e);
        this.featureGroup.clearLayers();
        this.fitBoundsService.fitBounds(searchResults.bounds, { maxZoom: LayersService.MAX_NATIVE_ZOOM } as L.FitBoundsOptions);
        var marker = L.marker(searchResults.latlng, { icon: IconsService.createSearchMarkerIcon(), draggable: false }) as Common.IMarkerWithTitle;
        marker.title = searchResults.name || searchResults.address;
        let markerPopupDiv = L.DomUtil.create("div");
        let componentFactory = this.componentFactoryResolver.resolveComponentFactory(SearchResultsMarkerPopupComponent);
        let componentRef = componentFactory.create(this.injector, [], markerPopupDiv);
        componentRef.instance.setMarker(marker);
        componentRef.instance.remove = () => {
            this.featureGroup.clearLayers();
        }
        componentRef.instance.angularBinding(componentRef.hostView);
        componentRef.instance.convertToRoute = () => {
            this.http.post(Urls.search, searchResults.feature).toPromise().then((response) => {
                let data = response.json() as Common.DataContainer;
                if (data.routes.length > 0) {
                    data.routes[0].markers = data.routes[0].markers || [];
                    data.routes[0].markers.push({ latlng: searchResults.latlng, title: marker.title, type: "" });
                }
                this.dataContainerService.setData({
                    routes: data.routes
                } as Common.DataContainer);
                this.featureGroup.clearLayers();
            });
        }
        marker.bindPopup(markerPopupDiv);

        this.featureGroup.addLayer(marker);
        for (let line of searchResults.latlngsArray) {
            let polyLine = L.polyline(line, this.getPathOprtions());
            this.featureGroup.addLayer(polyLine);
        }

        setTimeout(() => {
            marker.openPopup();
        }, 300);
        this.suppressEvents(e);
    }

    private selectResults = (searchContext: ISearchContext, searchResult: ISearchResults) => { //, e: Event
        searchContext.selectedSearchResults = searchResult;
        if (!this.isDirectional) {
            this.moveToResults(searchResult, new Event("click"));//e);
        }
    };

    public setRouting = (routingType: Common.RoutingType, e: Event) => {
        this.routingType = routingType;
        this.suppressEvents(e);
    }

    public searchRoute = (e: Event) => {
        this.suppressEvents(e);
        if (!this.fromContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectFrom);
            return;
        }
        if (!this.toContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectTo);
            return;
        }
        this.routerService.getRoute(this.fromContext.selectedSearchResults.latlng, this.toContext.selectedSearchResults.latlng, this.routingType).then((response: Common.RouteSegmentData[]) => {
            this.featureGroup.clearLayers();
            for (let segment of response) {
                let polyLine = L.polyline(segment.latlngs, this.getPathOprtions());
                this.featureGroup.addLayer(polyLine);
            }
            var markerFrom = L.marker(this.fromContext.selectedSearchResults.latlng, { icon: IconsService.createStartIcon(), draggable: false }) as Common.IMarkerWithTitle;
            markerFrom.title = this.fromContext.selectedSearchResults.name || this.fromContext.selectedSearchResults.address;
            var markerTo = L.marker(this.toContext.selectedSearchResults.latlng, { icon: IconsService.createEndIcon(), draggable: false }) as Common.IMarkerWithTitle;
            markerTo.title = this.toContext.selectedSearchResults.name || this.toContext.selectedSearchResults.address;

            let convertToRoute = () => {
                this.dataContainerService.setData({
                    routes: [
                        {
                            name: markerFrom.title + "-" + markerTo.title,
                            markers: [
                                { latlng: markerFrom.getLatLng(), title: markerFrom.title },
                                { latlng: markerTo.getLatLng(), title: markerTo.title }
                            ],
                            segments: response
                        }
                    ]
                } as Common.DataContainer);
                this.featureGroup.clearLayers();
            }

            let componentFactory = this.componentFactoryResolver.resolveComponentFactory(SearchResultsMarkerPopupComponent);
            let markerPopupFromDiv = L.DomUtil.create("div");
            let componentRefFrom = componentFactory.create(this.injector, [], markerPopupFromDiv);
            componentRefFrom.instance.setMarker(markerFrom);
            componentRefFrom.instance.remove = () => {
                this.featureGroup.clearLayers();
            }
            componentRefFrom.instance.convertToRoute = convertToRoute;
            componentRefFrom.instance.angularBinding(componentRefFrom.hostView);
            markerFrom.bindPopup(markerPopupFromDiv);
            this.featureGroup.addLayer(markerFrom);

            let markerPopupToDiv = L.DomUtil.create("div");
            let componentRefTo = componentFactory.create(this.injector, [], markerPopupToDiv);
            componentRefTo.instance.setMarker(markerTo);
            componentRefTo.instance.remove = () => {
                this.featureGroup.clearLayers();
            }
            componentRefTo.instance.convertToRoute = convertToRoute;
            componentRefTo.instance.angularBinding(componentRefTo.hostView);
            markerTo.bindPopup(markerPopupToDiv);
            this.featureGroup.addLayer(markerTo);

            this.fitBoundsService.fitBounds(this.featureGroup.getBounds());

            setTimeout(() => {
                markerTo.openPopup();
            }, 500);
        });
    }

    @HostListener("window:keydown", ["$event"])
    public onSearchShortcutKeys($event: KeyboardEvent) {
        if ($event.ctrlKey === false) {
            return true;
        }
        switch (String.fromCharCode($event.which).toLowerCase()) {
            case "f":
                this.toggleVisibility($event);
                break;
            default:
                return true;
        }
        return false;
    }

    private internalSearch = (searchContext: ISearchContext) => {
        let searchTerm = searchContext.searchTerm;
        this.requestsQueue.push({
            searchTerm: searchTerm
        } as ISearchRequestQueueItem);

        this.searchResultsProvider.getResults(searchTerm, this.resources.hasHebrewCharacters(searchTerm))
            .then((results: ISearchResults[]) => {
                let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.searchTerm === searchTerm);
                if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                    this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                    return;
                }
                if (searchContext.searchTerm !== searchTerm) {
                    // search term changed since it was requested.
                    _.remove(this.requestsQueue, queueItem);
                    return;
                }
                searchContext.searchResults = results;
                this.requestsQueue.splice(0);
            }, () => {
                this.toastService.warning(this.resources.unableToGetSearchResults);
            });
    }

    private getPathOprtions = (): L.PathOptions => {
        return { opacity: 1, color: "Blue", weight: 3 } as L.PathOptions;
    }
}