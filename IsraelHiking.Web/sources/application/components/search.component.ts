import {
    Component,
    HostListener,
    ViewEncapsulation,
    AfterViewInit,
    ViewChild,
    ViewChildren,
    ElementRef,
    QueryList
} from "@angular/core";
import { Router } from "@angular/router";
import { MatAutocompleteTrigger } from "@angular/material";
import { FormControl } from "@angular/forms";
import { debounceTime, filter, tap } from "rxjs/operators";
import { ENTER } from "@angular/cdk/keycodes";
import * as L from "leaflet";
import * as _ from "lodash";
import { Coordinate } from "openlayers";

import { ResourcesService } from "../services/resources.service";
import { HashService, RouteStrings, IApplicationStateChangedEventArgs } from "../services/hash.service";
import { DataContainerService } from "../services/data-container.service";
import { RouterService } from "../services/routers/router.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { ToastService } from "../services/toast.service";
import { SearchResultsProvider, ISearchResultsPointOfInterest } from "../services/search-results.provider";
import { BaseMapComponent } from "./base-map.component";
import { RoutingType, IMarkerWithTitle, DataContainer, LatLngAlt } from "../models/models";


export interface ISearchContext {
    searchTerm: string;
    searchResults: ISearchResultsPointOfInterest[];
    selectedSearchResults: ISearchResultsPointOfInterest;
}

interface ISearchRequestQueueItem {
    searchTerm: string;
}

interface IDirectionalContext {
    isOn: boolean;
    isMarkerPopupOpen: boolean;
    showResults: boolean;
    routeCoordinates: Coordinate[];
    routeTitle: string;
    convertToRoute: () => void;
    close: () => void;
    remove: () => void;
}

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class SearchComponent extends BaseMapComponent implements AfterViewInit {

    public isVisible: boolean;
    public fromContext: ISearchContext;
    public toContext: ISearchContext;
    public routingType: RoutingType;
    public searchFrom: FormControl;
    public searchTo: FormControl;
    public hasFocus: boolean;
    public directional: IDirectionalContext;

    private requestsQueue: ISearchRequestQueueItem[];
    private selectFirstSearchResults: boolean;

    @ViewChild("searchFromInput")
    public searchFromInput: ElementRef;

    @ViewChildren(MatAutocompleteTrigger)
    public matAutocompleteTriggers: QueryList<MatAutocompleteTrigger>;

    constructor(resources: ResourcesService,
        private readonly hashService: HashService,
        private readonly dataContainerService: DataContainerService,
        private readonly searchResultsProvider: SearchResultsProvider,
        private readonly routerService: RouterService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly toastService: ToastService,
        private readonly router: Router
    ) {
        super(resources);
        this.requestsQueue = [];
        this.directional = {
            isOn: false,
            isMarkerPopupOpen: false,
            routeCoordinates: [],
            routeTitle: "",
            showResults: false,
            convertToRoute: () => {},
            close: () => {},
            remove: () => {}
        };
        this.isVisible = false;
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
        this.directional.isOn = !this.directional.isOn;
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
        let bounds = { northEast: searchResults.southWest, southWest: searchResults.northEast };
        this.fitBoundsService.fitBounds(bounds);
        this.router.navigate([RouteStrings.ROUTE_POI, searchResults.source, searchResults.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }

    private selectResults = (searchContext: ISearchContext, searchResult: ISearchResultsPointOfInterest) => {
        searchContext.selectedSearchResults = searchResult;
        if (!this.directional.isOn) {
            this.moveToResults(searchResult, new Event("click"));
        }
    }

    public setRouting = (routingType: RoutingType, e: Event) => {
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
        this.directional.showResults = true;
        for (let segment of routeSegments) {
            for (let latlng of segment.latlngs) {
                this.directional.routeCoordinates.push([latlng.lng, latlng.lat]);
            }
        }
        this.directional.routeTitle = this.fromContext.selectedSearchResults.displayName +
            " - " +
            this.toContext.selectedSearchResults.displayName;

        this.directional.convertToRoute = () => {
            this.dataContainerService.setData({
                routes: [
                    {
                        name: this.directional.routeTitle,
                        markers: [],
                        segments: routeSegments
                    }
                ]
            } as DataContainer);
            this.directional.routeCoordinates = [];
        };
        this.directional.remove = () => {
            this.directional.routeCoordinates = [];
            this.directional.showResults = false;
        }
        this.directional.close = () => {
            this.directional.isMarkerPopupOpen = false;
        }
        this.directional.isMarkerPopupOpen = true;
        // HM TODO: fly to bounds, open popup
        //this.fitBoundsService.fitBounds(this.readonlyLayer.getBounds());
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
            let results = await this.searchResultsProvider.getResults(searchTerm, this.resources.hasRtlCharacters(searchTerm));
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