import { Component, DestroyRef, inject, signal, computed } from "@angular/core";
import { MatCheckbox } from "@angular/material/checkbox";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatButton } from "@angular/material/button";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatSlider, MatSliderRangeThumb } from "@angular/material/slider";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { OsmUserService } from "../services/osm-user.service";
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
    private readonly osmUserService = inject(OsmUserService);

    public readonly unitString = signal("km");
    public readonly filterLengthStart = signal<number>(0);
    public readonly filterLengthEnd = signal<number>(0);
    public readonly filterUserName = signal<string>(null);

    private readonly publicRoutesFilter = this.store.selectSignal((s: ApplicationState) => s.inMemoryState.publicRoutesFilter);

    public readonly isCategoryFiltered = computed(() => this.publicRoutesFilter().categories.length !== initialState.inMemoryState.publicRoutesFilter.categories.length);

    public readonly isDifficultyFiltered = computed(() => this.publicRoutesFilter().difficulty.length !== initialState.inMemoryState.publicRoutesFilter.difficulty.length);

    public readonly isLengthFiltered = computed(() => this.filterLengthStart() > 0 || this.filterLengthEnd() < 50);

    constructor() {
        this.store.select((state: ApplicationState) => state.configuration.units).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((units) => {
            this.unitString.set(this.resources.getLongDistanceUnitString(units));
        });
        this.store.select((state: ApplicationState) => state.inMemoryState.publicRoutesFilter).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(async (filters) => {
            this.filterLengthStart.set(filters.lengthRange[0]);
            this.filterLengthEnd.set(filters.lengthRange[1]);
            this.filterUserName.set(filters.userId ? await this.osmUserService.getUserName(filters.userId) : null);
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
        return this.publicRoutesFilter().categories.includes(category);
    }

    public isDificultySelected(difficulty: Difficulty) {
        return this.publicRoutesFilter().difficulty.includes(difficulty);
    }

    public onFilterLengthStartChange(value: string) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.lengthRange[0] = +value;
        this.filterLengthStart.set(+value);
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
    }

    public onFilterLengthEndChange(value: string) {
        const filters = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.publicRoutesFilter)) as PublicRoutesFilter;
        filters.lengthRange[1] = +value;
        this.filterLengthEnd.set(+value);
        this.store.dispatch(new SetPublicRoutesFilterAction(filters));
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