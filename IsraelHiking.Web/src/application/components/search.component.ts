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
import { Angulartics2OnModule } from "angulartics2";
import { NgClass } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatFormField } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { MatOption } from "@angular/material/core";
import { MatAutocompleteTrigger, MatAutocomplete } from "@angular/material/autocomplete";
import { FormControl, FormsModule, ReactiveFormsModule } from "@angular/forms";
import { debounceTime, filter, tap, map } from "rxjs/operators";
import { remove } from "lodash-es";

import { ResourcesService } from "../services/resources.service";
import { RouteStrings } from "../services/hash.service";
import { ToastService } from "../services/toast.service";
import { SearchResultsProvider } from "../services/search-results.provider";
import type { SearchResultsPointOfInterest } from "../models";

export type SearchContext = {
    searchTerm: string;
    searchResults: SearchResultsPointOfInterest[];
    selectedSearchResults: SearchResultsPointOfInterest;
};

type SearchRequestQueueItem = {
    searchTerm: string;
};

@Component({
    selector: "search",
    templateUrl: "./search.component.html",
    styleUrls: ["./search.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Angulartics2OnModule, NgClass, Dir, MatFormField, MatInput, FormsModule, MatAutocompleteTrigger, MatAutocomplete, ReactiveFormsModule, MatOption]
})
export class SearchComponent {

    public fromContext: SearchContext = {
        searchTerm: "",
        searchResults: [],
        selectedSearchResults: null
    };
    public searchFrom = new FormControl<string | SearchResultsPointOfInterest>("");

    private requestsQueue: SearchRequestQueueItem[] = [];
    private selectFirstSearchResults: boolean = false;

    public searchFromInput = viewChild<ElementRef>("searchFromInput");
    public matAutocompleteTriggers = viewChildren(MatAutocompleteTrigger);

    public readonly resources = inject(ResourcesService);
    private readonly searchResultsProvider = inject(SearchResultsProvider);
    private readonly toastService = inject(ToastService);
    private readonly router = inject(Router);

    constructor() {
        this.configureInputFormControl(this.searchFrom, this.fromContext);
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

    public focusOnSearchInput() {
        // ChangeDetectionRef doesn't work well for some reason...
        setTimeout(() => {
            this.searchFromInput().nativeElement.focus();
            this.searchFromInput().nativeElement.select();
        }, 100);

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
