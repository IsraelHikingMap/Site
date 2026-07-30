import {
    Component,
    HostListener,
    ViewEncapsulation,
    ElementRef,
    inject,
    viewChild,
    viewChildren, signal } from "@angular/core";
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

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [NgClass, Dir, MatFormField, MatInput, FormsModule, MatAutocompleteTrigger, MatAutocomplete, ReactiveFormsModule, MatOption]
})
export class SearchComponent {

    public searchResults = signal<SearchResultsPointOfInterest[]>([]);
    public searchTerm = signal("");
    private selectedSearchResults: SearchResultsPointOfInterest = null;
    public readonly searchFrom = new FormControl<string | SearchResultsPointOfInterest>("");

    private selectFirstSearchResults = false;
    private searchRequestId = 0;

    public searchFromInput = viewChild<ElementRef>("searchFromInput");
    public matAutocompleteTriggers = viewChildren(MatAutocompleteTrigger);

    public readonly resources = inject(ResourcesService);
    private readonly searchResultsProvider = inject(SearchResultsProvider);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);
    private readonly store = inject(Store);
    private readonly mapService = inject(MapService);

    private readonly currentUrl = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.currentUrl);
    private readonly userInfo = this.store.selectSignal((s: ApplicationState) => s.userState.userInfo);

    constructor() {
        this.configureInputFormControl(this.searchFrom);
    }

    public isLoggedIn(): boolean {
        return this.userInfo() != null;
    }

    private configureInputFormControl(input: FormControl<string | SearchResultsPointOfInterest>) {
        const stringValues$ = input.valueChanges.pipe(
            tap(x => {
                if (typeof x !== "string") {
                    this.selectResults(x);
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
            this.searchTerm.set(x);
            this.selectedSearchResults = null;
            this.search(true);
        });

        // Full term: only fires after typing genuinely stops
        stringValues$.pipe(
            debounceTime(1000),
            distinctUntilChanged()
        ).subscribe(x => {
            this.searchTerm.set(x);
            this.selectedSearchResults = null;
            this.search(false);
        });
    }

    public focusOnSearchInput() {
        // ChangeDetectionRef doesn't work well for some reason...
        setTimeout(() => {
            this.searchFromInput().nativeElement.focus();
            this.searchFromInput().nativeElement.select();
        }, 100);

    }

    public async search(isPrefix: boolean) {
        const requestId = ++this.searchRequestId;
        try {
            const results = await this.searchResultsProvider.getResults(this.searchTerm(), isPrefix, this.shouldUseMapCenter());
            if (requestId !== this.searchRequestId) {
                // A newer search was started while this request was in flight - ignore this stale response
                // so the displayed results always reflect the most recent query.
                return;
            }
            if (results == null) {
                return;
            }
            this.searchResults.set(results);
            if (this.selectFirstSearchResults && this.searchResults().length > 0) {
                this.selectResults(this.searchResults()[0]);
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

    private selectResults(searchResult: SearchResultsPointOfInterest) {
        this.selectedSearchResults = searchResult;
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
        if (this.selectedSearchResults == null && this.searchResults().length > 0) {
            this.selectResults(this.searchResults()[0]);
            return false;
        }
        this.selectFirstSearchResults = true;
        return false;
    }

    public isPoisSearch() {
        const currentUrl = this.currentUrl();
        return currentUrl !== RouteStrings.ROUTE_SHARES && currentUrl !== RouteStrings.ROUTE_TRACES;
    }

    /** 
     * Use map center only when the map is visible
     */
    private shouldUseMapCenter(): boolean {
        const currentUrl = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.currentUrl);
        return currentUrl !== RouteStrings.ROUTE_ROOT &&
            currentUrl !== RouteStrings.ROUTE_LANDING &&
            currentUrl !== RouteStrings.ROUTE_ABOUT;
    }

    public updateSearchTerm(searchTerm: string) {
        this.store.dispatch(new SetSearchTermAction(searchTerm));
    }

    public placeholder() {
        const currentUrl = this.currentUrl();
        if (currentUrl === RouteStrings.ROUTE_SHARES) {
            return this.resources.searchSharesPlaceHolder;
        }
        if (currentUrl === RouteStrings.ROUTE_TRACES) {
            return this.resources.searchTracesPlaceHolder;
        }
        return this.resources.searchPlaceHolder;
    }
}
