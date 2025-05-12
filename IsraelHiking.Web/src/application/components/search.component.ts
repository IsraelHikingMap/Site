import {
    Component,
    HostListener,
    ViewEncapsulation,
    ElementRef,
    inject,
    viewChild,
    viewChildren
} from "@angular/core";
import { Router } from "@angular/router";
import { MatButton } from "@angular/material/button";
import { Angulartics2OnModule } from "angulartics2";
import { MatTooltip } from "@angular/material/tooltip";
import { NgClass, NgFor, NgIf } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatOption } from "@angular/material/core";
import { MatAutocompleteTrigger, MatAutocomplete } from "@angular/material/autocomplete";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, filter, tap, map } from "rxjs/operators";
import { remove } from "lodash-es";
import { SourceDirective, GeoJSONSourceComponent, FeatureComponent, LayerComponent, PopupComponent } from "@maplibre/ngx-maplibre-gl";
import { Store } from "@ngxs/store";

import { CoordinatesComponent } from "./coordinates.component";
import { ResourcesService } from "../services/resources.service";
import { RouteStrings } from "../services/hash.service";
import { RoutingProvider } from "../services/routing.provider";
import { FitBoundsService } from "../services/fit-bounds.service";
import { ToastService } from "../services/toast.service";
import { SearchResultsProvider } from "../services/search-results.provider";
import { RoutesFactory } from "../services/routes.factory";
import { SpatialService } from "../services/spatial.service";
import { GpxDataContainerConverterService } from "../services/gpx-data-container-converter.service";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import type { RoutingType, LatLngAlt, SearchResultsPointOfInterest, LatLngAltTime } from "../models/models";

export type SearchContext = {
    searchTerm: string;
    searchResults: SearchResultsPointOfInterest[];
    selectedSearchResults: SearchResultsPointOfInterest;
};

type SearchRequestQueueItem = {
    searchTerm: string;
};

type DirectionalContext = {
    isOn: boolean;
    overlayLocation: LatLngAlt;
    showResults: boolean;
    /**
     * This is needed for display
     */
    routeCoordinates: [number, number][];
    /**
     * This is needed to facilitate easy conversion to private route to keep elevation data
     */
    latlngs: LatLngAlt[];
    routeTitle: string;
};

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [MatButton, Angulartics2OnModule, MatTooltip, NgClass, Dir, MatFormField, MatInput, FormsModule, MatAutocompleteTrigger, ReactiveFormsModule, MatAutocomplete, NgFor, MatOption, NgIf, SourceDirective, GeoJSONSourceComponent, FeatureComponent, LayerComponent, PopupComponent, CoordinatesComponent]
})
export class SearchComponent {

    public fromContext: SearchContext = {
        searchTerm: "",
        searchResults: [],
        selectedSearchResults: null
    };
    public toContext: SearchContext = {
        searchTerm: "",
        searchResults: [],
        selectedSearchResults: null
    };
    public routingType: RoutingType = "Hike";
    public searchFrom = new FormControl<string | SearchResultsPointOfInterest>("");
    public searchTo = new FormControl<string | SearchResultsPointOfInterest>("");
    public showCoordinates: boolean;
    public directional: DirectionalContext = {
        isOn: false,
        overlayLocation: null,
        routeCoordinates: [],
        latlngs: [],
        routeTitle: "",
        showResults: false,
    };

    private requestsQueue: SearchRequestQueueItem[] = [];
    private selectFirstSearchResults: boolean = false;

    public searchFromInput = viewChild<ElementRef>("searchFromInput");
    public matAutocompleteTriggers = viewChildren(MatAutocompleteTrigger);

    public readonly resources = inject(ResourcesService);
    private readonly searchResultsProvider = inject(SearchResultsProvider);
    private readonly routingProvider = inject(RoutingProvider);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly toastService = inject(ToastService);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly router = inject(Router);
    private readonly store = inject(Store);

    constructor() {
        this.configureInputFormControl(this.searchFrom, this.fromContext);
        this.configureInputFormControl(this.searchTo, this.toContext);
    }

    private configureInputFormControl(input: FormControl<string | SearchResultsPointOfInterest>, context: SearchContext) {
        input.valueChanges.pipe(
            tap(x => {
                if (typeof x !== "string") {
                    this.selectResults(context, x);
                } else {
                    this.selectFirstSearchResults = false;
                }
            }),
            filter(x => typeof x === "string"),
            map(x => x as string),
            debounceTime(500))
            .subscribe((x: string) => {
                context.searchTerm = x;
                context.selectedSearchResults = null;
                this.search(context);
            });
    }

    public openDirectionalSearchPopup(event: any) {
        if (this.directional.overlayLocation == null ||
            SpatialService.getDistanceInMeters(this.directional.overlayLocation, event.lngLat) > 10) {
            this.directional.overlayLocation = event.lngLat;
            return;
        }
        this.directional.overlayLocation = null;
    }

    public focusOnSearchInput() {
        // ChangeDetectionRef doesn't work well for some reason...
        setTimeout(() => {            
            this.searchFromInput().nativeElement.focus();
            this.searchFromInput().nativeElement.select();
        }, 100);

    }

    public toggleDirectional() {
        this.directional.isOn = !this.directional.isOn;
    }

    public search(searchContext: SearchContext) {
        if (searchContext.searchTerm.length <= 2) {
            searchContext.searchResults = [];
            return;
        }
        this.internalSearch(searchContext);
    }

    public displayResults(results: SearchResultsPointOfInterest) {
        return results ? results.displayName : "";
    }

    public moveToResults(searchResults: SearchResultsPointOfInterest) {
        this.router.navigate([RouteStrings.ROUTE_POI, searchResults.source, searchResults.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }

    private selectResults(searchContext: SearchContext, searchResult: SearchResultsPointOfInterest) {
        searchContext.selectedSearchResults = searchResult;
        if (!this.directional.isOn) {
            this.moveToResults(searchResult);
        }
    }

    public setRouting(routingType: RoutingType) {
        this.routingType = routingType;
    }

    public async searchRoute() {
        this.clearDirectionalRoute();
        if (!this.fromContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectFrom);
            return;
        }
        if (!this.toContext.selectedSearchResults) {
            this.toastService.warning(this.resources.pleaseSelectTo);
            return;
        }
        const latlngs = await this.routingProvider.getRoute(this.fromContext.selectedSearchResults.location,
            this.toContext.selectedSearchResults.location,
            this.routingType);
        this.directional.showResults = true;
        this.directional.routeCoordinates = latlngs.map(l => SpatialService.toCoordinate(l));
        this.directional.latlngs = latlngs;
        this.directional.routeTitle = this.fromContext.selectedSearchResults.displayName +
            " - " +
            this.toContext.selectedSearchResults.displayName;
        this.directional.overlayLocation = latlngs[0];
        const bounds = SpatialService.getBounds(latlngs);
        this.fitBoundsService.fitBounds(bounds);
    }

    public convertToRoute() {
        const route = this.routesFactory.createRouteData(this.directional.routeTitle);
        route.segments = GpxDataContainerConverterService
            .getSegmentsFromLatlngs(this.directional.latlngs as LatLngAltTime[], this.routingType);
        this.store.dispatch(new AddRouteAction(route));
        this.store.dispatch(new SetSelectedRouteAction(route.id));
        this.clearDirectionalRoute();
    }

    public clearDirectionalRoute() {
        this.directional.routeCoordinates = [];
        this.directional.latlngs = [];
        this.directional.showResults = false;
    }

    @HostListener("window:keydown", ["$event"])
    public onSearchShortcutKeys($event: KeyboardEvent) {
        if ($event.key === "Enter") {
            return this.handleEnterKeydown();
        }
        if ($event.ctrlKey === false && $event.metaKey === false) {
            return true;
        }
        if ($event.key == null) {
            return true;
        }
        switch ($event.key.toLowerCase()) {
            case "f":
                this.focusOnSearchInput();
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
     *
     * @returns true - if no operations was made, false otherwise
     */
    private handleEnterKeydown(): boolean {
        if (this.matAutocompleteTriggers()[0] == null) {
            return true;
        }
        if (this.matAutocompleteTriggers()[0].activeOption != null) {
            return true;
        }
        if (this.fromContext.selectedSearchResults == null && this.fromContext.searchResults.length > 0) {
            this.selectResults(this.fromContext, this.fromContext.searchResults[0]);
            return false;
        }
        this.selectFirstSearchResults = true;
        return false;
    }

    private async internalSearch(searchContext: SearchContext) {
        const searchTerm = searchContext.searchTerm;
        this.requestsQueue.push({
            searchTerm
        } as SearchRequestQueueItem);
        try {
            const results = await this.searchResultsProvider.getResults(searchTerm);
            const queueItem = this.requestsQueue.find(itemToFind => itemToFind.searchTerm === searchTerm);
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
        } catch {
            this.toastService.warning(this.resources.unableToGetSearchResults);
        }
    }
}
