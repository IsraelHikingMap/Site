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
import { NgClass } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatOption } from "@angular/material/core";
import { MatAutocompleteTrigger, MatAutocomplete } from "@angular/material/autocomplete";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, filter, tap, distinctUntilChanged, share } from "rxjs/operators";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { RouteStrings } from "../services/hash.service";
import { ToastService } from "../services/toast.service";
import { MapService } from "../services/map.service";
import { SearchResultsProvider } from "../services/search-results.provider";
import { SetSearchTermAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, SearchResultsPointOfInterest } from "../models";

export type SearchContext = {
    searchTerm: string;
    searchResults: SearchResultsPointOfInterest[];
    selectedSearchResults: SearchResultsPointOfInterest;
};

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [NgClass, Dir, MatFormField, MatInput, FormsModule, MatAutocompleteTrigger, MatAutocomplete, ReactiveFormsModule, MatOption]
})
export class SearchComponent {

    public fromContext: SearchContext = {
        searchTerm: "",
        searchResults: [],
        selectedSearchResults: null
    };
    public searchFrom = new FormControl<string | SearchResultsPointOfInterest>("");

    private selectFirstSearchResults = false;

    public searchFromInput = viewChild<ElementRef>("searchFromInput");
    public matAutocompleteTriggers = viewChildren(MatAutocompleteTrigger);

    public readonly resources = inject(ResourcesService);
    private readonly searchResultsProvider = inject(SearchResultsProvider);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly store = inject(Store);
    private readonly mapService = inject(MapService);

    constructor() {
        this.configureInputFormControl(this.searchFrom, this.fromContext);
    }

    public isLoggedIn(): boolean {
        return this.store.selectSnapshot((state: ApplicationState) => state.userState.userInfo) != null;
    }

    private configureInputFormControl(input: FormControl<string | SearchResultsPointOfInterest>, context: SearchContext) {
        const stringValues$ = input.valueChanges.pipe(
            tap(x => {
                if (typeof x !== "string") {
                    this.selectResults(context, x);
                } else {
                    this.selectFirstSearchResults = false;
                }
            }),
            filter((x): x is string => typeof x === "string"),
            share()
        );

        // Prefix: fires on each keystroke (no debounce)
        stringValues$.pipe(
            debounceTime(200),
            distinctUntilChanged()
        ).subscribe(x => {
            context.searchTerm = x;
            context.selectedSearchResults = null;
            this.search(context, true);
        });

        // Full term: only fires after typing genuinely stops
        stringValues$.pipe(
            debounceTime(1000),
            distinctUntilChanged()
        ).subscribe(x => {
            context.searchTerm = x;
            context.selectedSearchResults = null;
            this.search(context, false);
        });
    }

    public focusOnSearchInput() {
        // ChangeDetectionRef doesn't work well for some reason...
        setTimeout(() => {
            this.searchFromInput().nativeElement.focus();
            this.searchFromInput().nativeElement.select();
        }, 100);

    }

    public async search(searchContext: SearchContext, isPrefix: boolean) {
        try {
            const results = await this.searchResultsProvider.getResults(searchContext.searchTerm, isPrefix);
            if (results == null) {
                return;
            }
            searchContext.searchResults = results;
            if (this.selectFirstSearchResults && searchContext.searchResults.length > 0) {
                this.selectResults(searchContext, searchContext.searchResults[0]);
            }
            this.selectFirstSearchResults = false;
        } catch {
            this.toastService.warning(this.resources.unableToGetSearchResults);
        }
    }

    public displayResults(results: SearchResultsPointOfInterest) {
        return results ? results.displayName : "";
    }
    /**
     * Return the icon color for the given search result.
     * In case the icon color is black (like in coordinate results, caves, etc.) 
     * return the theme's on-surface color instead.
     * @param result 
     * @returns 
     */
    public getIconColor(result: SearchResultsPointOfInterest): string {
        const color = result.iconColor;
        return color === "black" || color === "#000000" || color === "#000"
            ? "var(--mat-sys-on-surface)"
            : color;
    }

    public moveToResults(searchResults: SearchResultsPointOfInterest) {
        if (this.router.url === RouteStrings.ROUTE_PUBLIC_ROUTES) {
            this.mapService.flyTo(searchResults.location);
            return;
        }

        this.router.navigate([RouteStrings.ROUTE_POI, searchResults.source, searchResults.id]);
    }

    private selectResults(searchContext: SearchContext, searchResult: SearchResultsPointOfInterest) {
        searchContext.selectedSearchResults = searchResult;
        this.moveToResults(searchResult);
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

    public isPoisSearch() {
        const currentUrl = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.currentUrl);
        return currentUrl !== RouteStrings.ROUTE_SHARES && currentUrl !== RouteStrings.ROUTE_TRACES;
    }

    public updateSearchTerm(searchTerm: string) {
        this.store.dispatch(new SetSearchTermAction(searchTerm));
    }

    public placeholder() {
        const currentUrl = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.currentUrl);
        if (currentUrl === RouteStrings.ROUTE_SHARES) {
            return this.resources.searchSharesPlaceHolder;
        }
        if (currentUrl === RouteStrings.ROUTE_TRACES) {
            return this.resources.searchTracesPlaceHolder;
        }
        return this.resources.searchPlaceHolder;
    }
}
