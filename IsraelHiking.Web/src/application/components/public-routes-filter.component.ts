import { Component, DestroyRef, inject } from "@angular/core";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatButton } from "@angular/material/button";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatSlider, MatSliderRangeThumb } from "@angular/material/slider";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { ImageAttributionService } from "../services/image-attribution.service";
import { SetPublicRoutesFilterAction } from "../reducers/in-memory.reducer";
import { initialState } from "../reducers/initial-state";
import type { ApplicationState, CategoryType, Difficulty, PublicRoutesFilter } from "../models";

@Component({
    selector: "public-routes-filter",
    templateUrl: "./public-routes-filter.component.html",
    imports: [MatCheckbox, MatMenu, MatMenuItem, MatSliderRangeThumb, MatSlider, MatMenuTrigger, MatButton]
})
export class PublicRoutesFilterComponent {
    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);
    private readonly destroyRef = inject(DestroyRef);
    private readonly imageAttributionService = inject(ImageAttributionService);

    public unitString = "km";
    public filterLengthStart: number;
    public filterLengthEnd: number;
    public filterUserName: string;

    constructor() {
        this.store.select((state: ApplicationState) => state.configuration.units).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((units) => {
            this.unitString = this.resources.getLongDistanceUnitString(units);
        });
        this.store.select((state: ApplicationState) => state.inMemoryState.publicRoutesFilter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (filters) => {
            this.filterLengthStart = filters.lengthRange[0];
            this.filterLengthEnd = filters.lengthRange[1];
            this.filterUserName = filters.userId ? await this.imageAttributionService.getUserName(filters.userId) : null;
        });
    }

    public onFilterCategoryChange(value: CategoryType) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        if (filters.categories.includes(value)) {
            filters.categories = filters.categories.filter((x) => x !== value);
        } else {
            filters.categories.push(value);
        }
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public onFilterDifficultyChange(value: Difficulty) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        if (filters.difficulty.includes(value)) {
            filters.difficulty = filters.difficulty.filter((x) => x !== value);
        } else {
            filters.difficulty.push(value);
        }
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public isCategorySelected(category: CategoryType) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.categories.includes(category);
    }

    public isCategoryFiltered() {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.categories.length !== initialState.inMemoryState.publicRoutesFilter.categories.length;
    }

    public isDifficultyFiltered() {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.difficulty.length !== initialState.inMemoryState.publicRoutesFilter.difficulty.length;
    }

    public isDificultySelected(difficulty: Difficulty) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        return filters.difficulty.includes(difficulty);
    }

    public onFilterLengthStartChange(value: string) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.lengthRange[0] = +value;
        this.filterLengthStart = +value;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public onFilterLengthEndChange(value: string) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.lengthRange[1] = +value;
        this.filterLengthEnd = +value;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public isLengthFiltered() {
        return this.filterLengthStart > 0 || this.filterLengthEnd < 50
    }

    public hasUserFilter() {
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter.userId) != null;
    }

    public clearUserFilter() {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.userId = null;
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }
}