import { Component, DestroyRef, inject } from "@angular/core";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatButton } from "@angular/material/button";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatSlider, MatSliderRangeThumb } from "@angular/material/slider";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { SetPublicRoutesFilterAction } from "../reducers/in-memory.reducer";
import { initialState } from '../reducers/initial-state';
import type { ApplicationState, PublicRoutesFilter } from "../models";

@Component({
    selector: "public-routes-filter",
    templateUrl: "./public-routes-filter.component.html",
    imports: [MatCheckbox, MatMenu, MatMenuItem, MatSliderRangeThumb, MatSlider, MatMenuTrigger, MatButton]
})
export class PublicRoutesFilterComponent {
    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);
    private readonly destroyRef = inject(DestroyRef);

    public unitString: string = "km";
    public filterLengthStart: number;
    public filterLengthEnd: number;

    constructor() {
        this.store.select((state: ApplicationState) => state.configuration.units).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((units) => {
            this.unitString = this.resources.getLongDistanceUnitString(units);
        });
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter));
        this.filterLengthStart = filters.lengthRange[0];
        this.filterLengthEnd = filters.lengthRange[1];
    }

    public onFilterCategoryChange(value: string) {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        if (filters.categories.includes(value)) {
            filters.categories = filters.categories.filter((x) => x !== value);
        } else {
            filters.categories.push(value);
        }
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public onFilterDifficultyChange(value: string) {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        if (filters.difficulty.includes(value)) {
            filters.difficulty = filters.difficulty.filter((x) => x !== value);
        } else {
            filters.difficulty.push(value);
        }
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public isCategorySelected(category: string) {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.categories.includes(category);
    }

    public isCategoryFiltered() {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.categories.length !== initialState.inMemoryState.publicRoutesFilter.categories.length;
    }

    public isDifficultyFiltered() {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.difficulty.length !== initialState.inMemoryState.publicRoutesFilter.difficulty.length;
    }

    public isDificultySelected(difficulty: string) {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.difficulty.includes(difficulty);
    }

    public onFilterLengthStartChange(value: string) {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.lengthRange[0] = +value;
        this.filterLengthStart = +value;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public onFilterLengthEndChange(value: string) {
        let filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.lengthRange[1] = +value;
        this.filterLengthEnd = +value;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public isLengthFiltered() {
        return this.filterLengthStart > 0 || this.filterLengthEnd < 50
    }
}