import {
    Component,
    HostListener,
    ViewEncapsulation,
    ViewChild,
    ViewChildren,
    ElementRef,
    QueryList
} from "@angular/core";
import { Router } from "@angular/router";
import { MatAutocompleteTrigger } from "@angular/material/autocomplete";
import { FormControl } from "@angular/forms";
import { debounceTime, filter, tap } from "rxjs/operators";
import { remove } from "lodash";
import { PointLike } from "mapbox-gl";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { skip } from "rxjs/operators";

import { ResourcesService } from "../services/resources.service";
import { RouteStrings } from "../services/hash.service";
import { RouterService } from "../services/router.service";
import { FitBoundsService } from "../services/fit-bounds.service";
import { ToastService } from "../services/toast.service";
import { SearchResultsProvider, ISearchResultsPointOfInterest } from "../services/search-results.provider";
import { BaseMapComponent } from "./base-map.component";
import { RoutingType, ApplicationState, RouteSegmentData, LatLngAlt } from "../models/models";
import { RoutesFactory } from "../services/layers/routelayers/routes.factory";
import { AddRouteAction } from "../reducres/routes.reducer";
import { SpatialService } from "../services/spatial.service";
import { SetSelectedRouteAction } from "../reducres/route-editing-state.reducer";

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
    overlayLocation: LatLngAlt;
    showResults: boolean;
    routeCoordinates: PointLike[];
    routeTitle: string;
    routeSegments: RouteSegmentData[];
}

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class SearchComponent extends BaseMapComponent {

    public isOpen: boolean;
    public fromContext: ISearchContext;
    public toContext: ISearchContext;
    public routingType: RoutingType;
    public searchFrom: FormControl;
    public searchTo: FormControl;
    public hasFocus: boolean;
    public hideCoordinates: boolean;
    public directional: IDirectionalContext;

    private requestsQueue: ISearchRequestQueueItem[];
    private selectFirstSearchResults: boolean;

    @ViewChild("searchFromInput")
    public searchFromInput: ElementRef;

    @ViewChildren(MatAutocompleteTrigger)
    public matAutocompleteTriggers: QueryList<MatAutocompleteTrigger>;

    @select((state: ApplicationState) => state.uiComponentsState.searchVisible)
    public searchVisible$: Observable<boolean>;

    constructor(resources: ResourcesService,
                private readonly searchResultsProvider: SearchResultsProvider,
                private readonly routerService: RouterService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly toastService: ToastService,
                private readonly routesFactory: RoutesFactory,
                private readonly router: Router,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.requestsQueue = [];
        this.directional = {
            isOn: false,
            overlayLocation: null,
            routeCoordinates: [],
            routeTitle: "",
            showResults: false,
            routeSegments: []
        };
        this.isOpen = false;
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
        this.searchFrom = new FormControl();
        this.searchTo = new FormControl();
        this.configureInputFormControl(this.searchFrom, this.fromContext);
        this.configureInputFormControl(this.searchTo, this.toContext);

        this.searchVisible$.pipe(skip(1)).subscribe(visible => {
            // ignore the first value since it always emit one and we want to get the changes only...
            if (visible && this.isOpen) {
                this.focusOnSearchInput();
            } else if (visible) {
                this.toggleOpen();
            }
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

    public openDirectionalSearchPopup(event) {
        if (this.directional.overlayLocation == null ||
            SpatialService.getDistanceInMeters(this.directional.overlayLocation, event.lngLat) > 10) {
            this.directional.overlayLocation = event.lngLat;
            return;
        }
        this.directional.overlayLocation = null;
    }

    public toggleOpen() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.focusOnSearchInput();
        } else {
            this.matAutocompleteTriggers.forEach(trigger => trigger.closePanel());
        }
    }

    private focusOnSearchInput() {
        // ChangeDetectionRef doesn't work well for some reason...
        setTimeout(() => {
            this.searchFromInput.nativeElement.focus();
            this.searchFromInput.nativeElement.select();
        }, 100);

    }

    public toggleDirectional() {
        this.directional.isOn = !this.directional.isOn;
    }

    public search(searchContext: ISearchContext) {
        if (searchContext.searchTerm.length <= 2) {
            searchContext.searchResults = [];
            return;
        }
        this.internalSearch(searchContext);
    }

    public displayResults(results: ISearchResultsPointOfInterest) {
        return results ? results.displayName : "";
    }

    public moveToResults(searchResults: ISearchResultsPointOfInterest) {
        if (this.isOpen) {
            this.toggleOpen();
        }
        this.router.navigate([RouteStrings.ROUTE_POI, searchResults.source, searchResults.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }

    private selectResults(searchContext: ISearchContext, searchResult: ISearchResultsPointOfInterest) {
        searchContext.selectedSearchResults = searchResult;
        if (!this.directional.isOn) {
            this.moveToResults(searchResult);
        }
    }

    public setRouting(routingType: RoutingType) {
        this.routingType = routingType;
    }

    public async searchRoute() {
        if (!this.fromContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectFrom);
            return;
        }
        if (!this.toContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectTo);
            return;
        }
        this.directional.routeSegments = await this.routerService.getRoute(this.fromContext.selectedSearchResults.location,
            this.toContext.selectedSearchResults.location,
            this.routingType);
        this.directional.showResults = true;
        let latlngs = [];
        for (let segment of this.directional.routeSegments) {
            for (let latlng of segment.latlngs) {
                latlngs.push(latlng);
                this.directional.routeCoordinates.push([latlng.lng, latlng.lat]);
            }
        }
        this.directional.routeTitle = this.fromContext.selectedSearchResults.displayName +
            " - " +
            this.toContext.selectedSearchResults.displayName;
        this.directional.overlayLocation = latlngs[0];
        let bounds = SpatialService.getBounds(latlngs);
        this.fitBoundsService.fitBounds(bounds);
    }

    public convertToRoute() {
        let route = this.routesFactory.createRouteData(this.directional.routeTitle);
        route.segments = this.directional.routeSegments;
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: route
        }));
        this.ngRedux.dispatch(new SetSelectedRouteAction({
            routeId: route.id
        }));
        this.directionalCleared();
    }

    public directionalCleared() {
        this.directional.routeCoordinates = [];
        this.directional.showResults = false;
    }

    @HostListener("window:keydown", ["$event"])
    public onSearchShortcutKeys($event: KeyboardEvent) {
        if ($event.key === "Enter") {
            return this.handleEnterKeydown();
        }
        if ($event.ctrlKey === false) {
            return true;
        }
        if ($event.key == null) {
            return true;
        }
        switch ($event.key.toLowerCase()) {
            case "f":
                this.toggleOpen();
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

    private async internalSearch(searchContext: ISearchContext) {
        let searchTerm = searchContext.searchTerm;
        this.requestsQueue.push({
            searchTerm
        } as ISearchRequestQueueItem);
        try {
            let results = await this.searchResultsProvider.getResults(searchTerm, this.resources.hasRtlCharacters(searchTerm));
            let queueItem = this.requestsQueue.find(itemToFind => itemToFind.searchTerm === searchTerm);
            if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                return;
            }
            if (searchContext.searchTerm !== searchTerm) {
                // search term changed since it was requested.
                remove(this.requestsQueue, queueItem);
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
