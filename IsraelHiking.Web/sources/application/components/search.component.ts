import {
    Component,
    Injector,
    ComponentFactoryResolver,
    HostListener,
    ViewEncapsulation,
    AfterViewInit,
    ViewChild,
    ViewChildren,
    ElementRef,
    ComponentFactory,
    QueryList
} from "@angular/core";
import { Router } from "@angular/router";
import { MatAutocompleteTrigger } from "@angular/material";
import { FormControl } from "@angular/forms";
import { debounceTime, filter, tap } from "rxjs/operators";
import { ENTER } from "@angular/cdk/keycodes";
import * as L from "leaflet";
import * as _ from "lodash";

import { MapService } from "../services/map.service";
import { ResourcesService } from "../services/resources.service";
import { HashService, RouteStrings, IApplicationStateChangedEventArgs } from "../services/hash.service";
import { DataContainerService } from "../services/data-container.service";
import { ElevationProvider } from "../services/elevation.provider";
import { RouterService } from "../services/routers/router.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { IconsService } from "../services/icons.service";
import { ToastService } from "../services/toast.service";
import { SearchResultsProvider, ISearchResultsPointOfInterest } from "../services/search-results.provider";
import { BaseMapComponent } from "./base-map.component";
import { SearchResultsMarkerPopupComponent } from "./markerpopup/search-results-marker-popup.component";
import { CategoriesLayerFactory } from "../services/layers/categories-layers.factory";
import * as Common from "../common/IsraelHiking";


export interface ISearchContext {
    searchTerm: string;
    searchResults: ISearchResultsPointOfInterest[];
    selectedSearchResults: ISearchResultsPointOfInterest;
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
    public hasFocus: boolean;

    private requestsQueue: ISearchRequestQueueItem[];
    private readonlyLayer: L.FeatureGroup;
    private selectFirstSearchResults: boolean;

    @ViewChild("searchFromInput")
    public searchFromInput: ElementRef;

    @ViewChildren(MatAutocompleteTrigger)
    public matAutocompleteTriggers: QueryList<MatAutocompleteTrigger>;

    constructor(resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly hashService: HashService,
        private readonly dataContainerService: DataContainerService,
        private readonly elevationProvider: ElevationProvider,
        private readonly searchResultsProvider: SearchResultsProvider,
        private readonly routerService: RouterService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly injector: Injector,
        private readonly componentFactoryResolver: ComponentFactoryResolver,
        private readonly toastService: ToastService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly router: Router
    ) {
        super(resources);
        this.requestsQueue = [];
        this.readonlyLayer = L.featureGroup();
        this.mapService.map.addLayer(this.readonlyLayer);
        this.isVisible = false;
        this.isDirectional = false;
        this.routingType = "Hike";
        this.selectFirstSearchResults = false;
        this.fromContext = {
            searchTerm: "",
            searchResults: [],
            selectedSearchResults: null
        } as ISearchContext;
        this.toContext = {
            searchTerm: "",
            searchResults: [],
            selectedSearchResults: null
        } as ISearchContext;
        this.isVisible = false;
        this.searchFrom = new FormControl();
        this.searchTo = new FormControl();
        this.configureInputFormControl(this.searchFrom, this.fromContext);
        this.configureInputFormControl(this.searchTo, this.toContext);

        this.hashService.applicationStateChanged
            .pipe(filter((f: IApplicationStateChangedEventArgs) => f.type === "search"))
            .subscribe(args => {
                this.fromContext.searchTerm = args.value;
                this.searchFrom =
                    new FormControl({ displayName: this.fromContext.searchTerm } as ISearchResultsPointOfInterest);
                this.selectFirstSearchResults = true;
                this.search(this.fromContext);
            });
    }

    private configureInputFormControl(input: FormControl, context: ISearchContext) {
        input.valueChanges.pipe(
            tap(x => {
                if (typeof x !== "string") {
                    this.selectResults(context, x);
                } else {
                    this.selectFirstSearchResults = false;
                }
            }),
            filter(x => typeof x === "string"),
            debounceTime(500))
            .subscribe((x: string) => {
                context.searchTerm = x;
                context.selectedSearchResults = null;
                this.search(context);
            });
    }

    public ngAfterViewInit() {
        if (this.isVisible) {
            setTimeout(() => {
                this.searchFromInput.nativeElement.focus();
                this.search(this.fromContext);
            }, 100);
        }
    }

    public toggleVisibility = (e: Event) => {
        this.isVisible = !this.isVisible;
        if (this.isVisible) {
            // allow DOM make the input visible
            setTimeout(() => {
                this.searchFromInput.nativeElement.focus();
                this.searchFromInput.nativeElement.select();
            },
                100);
        } else {
            this.matAutocompleteTriggers.forEach(trigger => trigger.closePanel());
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

    public displayResults(results: ISearchResultsPointOfInterest) {
        return results ? results.displayName : "";
    }

    public moveToResults = (searchResults: ISearchResultsPointOfInterest, e: Event) => {
        if (this.isVisible) {
            this.toggleVisibility(e);
        }
        let bounds = L.latLngBounds(searchResults.southWest, searchResults.northEast);
        this.categoriesLayerFactory.getByPoiType(searchResults.isRoute).moveToSearchResults(searchResults, bounds);
        this.router.navigate([RouteStrings.ROUTE_POI, searchResults.source, searchResults.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }

    private selectResults = (searchContext: ISearchContext, searchResult: ISearchResultsPointOfInterest) => {
        searchContext.selectedSearchResults = searchResult;
        if (!this.isDirectional) {
            this.moveToResults(searchResult, new Event("click"));
        }
    }

    public setRouting = (routingType: Common.RoutingType, e: Event) => {
        this.routingType = routingType;
        this.suppressEvents(e);
    }

    public searchRoute = async (e: Event) => {
        this.suppressEvents(e);
        if (!this.fromContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectFrom);
            return;
        }
        if (!this.toContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectTo);
            return;
        }
        let routeSegments = await this.routerService.getRoute(this.fromContext.selectedSearchResults.location,
            this.toContext.selectedSearchResults.location,
            this.routingType);
        this.readonlyLayer.clearLayers();
        this.mapService.updateReadOnlyLayer(this.readonlyLayer, [{ segments: routeSegments, markers: [] } as Common.RouteData]);
        let markerFrom = L.marker(this.fromContext.selectedSearchResults.location,
            {
                icon: IconsService.createStartIcon(),
                draggable: false
            }) as Common.IMarkerWithTitle;
        markerFrom.title = this.fromContext.selectedSearchResults.displayName;
        let markerTo = L.marker(this.toContext.selectedSearchResults.location,
            {
                icon: IconsService.createEndIcon(),
                draggable: false
            }) as Common.IMarkerWithTitle;
        markerTo.title = this.toContext.selectedSearchResults.displayName;

        let convertToRoute = () => {
            this.dataContainerService.setData({
                routes: [
                    {
                        name: markerFrom.title + "-" + markerTo.title,
                        markers: [
                            { latlng: markerFrom.getLatLng(), title: markerFrom.title },
                            { latlng: markerTo.getLatLng(), title: markerTo.title }
                        ],
                        segments: routeSegments
                    }
                ]
            } as Common.DataContainer);
            this.readonlyLayer.clearLayers();
        };

        let componentFactory = this.componentFactoryResolver.resolveComponentFactory(SearchResultsMarkerPopupComponent);
        this.createSearchRouteMarkerPopup(markerFrom, componentFactory, convertToRoute);
        this.createSearchRouteMarkerPopup(markerTo, componentFactory, convertToRoute);

        this.fitBoundsService.fitBounds(this.readonlyLayer.getBounds());

        setTimeout(() => markerTo.openPopup(), 500);
    }

    private createSearchRouteMarkerPopup(marker: Common.IMarkerWithTitle,
        componentFactory: ComponentFactory<SearchResultsMarkerPopupComponent>,
        convertToRoute: () => void) {

        let markerPopupDiv = L.DomUtil.create("div");
        let componentRef = componentFactory.create(this.injector, [], markerPopupDiv);
        componentRef.instance.setMarker(marker);
        componentRef.instance.remove = () => {
            this.readonlyLayer.clearLayers();
        };
        componentRef.instance.convertToRoute = convertToRoute;
        componentRef.instance.angularBinding(componentRef.hostView);
        marker.bindPopup(markerPopupDiv);
        this.readonlyLayer.addLayer(marker);
    }

    @HostListener("window:keydown", ["$event"])
    public onSearchShortcutKeys($event: KeyboardEvent) {
        if ($event.keyCode === ENTER) {
            return this.handleEnterKeydown();
        }
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
    /**
     * This function should make sure the ENTER key is behaving as it should:
     * In case there are search results open and non is selected - select the first result.
     * In case a search is being made - when the search is finshed select the first result.
     * @returns true - if no operations was made, false otherwise
     */
    private handleEnterKeydown(): boolean {
        if (!this.hasFocus) {
            return true;
        }
        if (this.matAutocompleteTriggers.first == null) {
            return true;
        }
        if (this.matAutocompleteTriggers.first.activeOption != null) {
            return true;
        }
        if (this.fromContext.selectedSearchResults == null && this.fromContext.searchResults.length > 0) {
            this.selectResults(this.fromContext, this.fromContext.searchResults[0]);
            return false;
        }
        this.selectFirstSearchResults = true;
        return false;
    }

    private internalSearch = async (searchContext: ISearchContext) => {
        let searchTerm = searchContext.searchTerm;
        this.requestsQueue.push({
            searchTerm: searchTerm
        } as ISearchRequestQueueItem);
        try {
            let results = await this.searchResultsProvider.getResults(searchTerm, this.resources.hasHebrewCharacters(searchTerm));
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
            if (this.selectFirstSearchResults && searchContext.searchResults.length > 0) {
                this.selectResults(searchContext, searchContext.searchResults[0]);
            }
            this.selectFirstSearchResults = false;
        } catch (ex) {
            this.toastService.warning(this.resources.unableToGetSearchResults);
        }
    }
}