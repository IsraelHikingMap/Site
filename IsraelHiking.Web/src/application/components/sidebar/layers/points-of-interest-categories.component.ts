import { Component, inject, computed } from "@angular/core";
import { MatIconButton } from "@angular/material/button";
import { MatChipListbox, MatChipOption } from "@angular/material/chips";
import { NgClass } from "@angular/common";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../../../directives/analytics.directive";
import { ResourcesService } from "../../../services/resources.service";
import { TogglePoisCategoriesVisibilityAction, ToggleCategoryVisibilityAction } from "../../../reducers/layers.reducer";
import { POINTS_OF_INTEREST_CATEGORIES } from "../../../reducers/initial-state";
import type { ApplicationState, Category } from "../../../models";

@Component({
    selector: "points-of-interest-categories",
    templateUrl: "./points-of-interest-categories.component.html",
    imports: [MatIconButton, MatChipListbox, MatChipOption, AnalyticsDirective, NgClass]
})
export class PointsOfInterestCategoriesComponent {

    public readonly categories = POINTS_OF_INTEREST_CATEGORIES

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

    private readonly layersState = this.store.selectSignal((s: ApplicationState) => s.layersState);

    public readonly isCategoryGroupVisible = computed(() => this.layersState().visiblePoisCategories.length > 0);

    public toggleCategory(category: Category) {
        this.store.dispatch(new ToggleCategoryVisibilityAction(category.name));
    }

    public toggleVisibility() {
        this.store.dispatch(new TogglePoisCategoriesVisibilityAction());
    }

    public isCategoryVisible(category: Category): boolean {
        return this.layersState().visiblePoisCategories.includes(category.name);
    }
}
