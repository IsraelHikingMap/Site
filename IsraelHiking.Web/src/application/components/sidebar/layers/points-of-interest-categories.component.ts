import { Component, inject } from "@angular/core";
import { MatExpansionPanel, MatExpansionPanelHeader } from "@angular/material/expansion";
import { MatButton } from "@angular/material/button";
import { NgClass } from "@angular/common";
import { Store } from "@ngxs/store";

import { AnalyticsDirective } from "../../../directives/analytics.directive";
import { ResourcesService } from "../../../services/resources.service";
import {
    CollapseGroupAction,
    ExpandGroupAction,
    TogglePoisCategoriesVisibilityAction,
    ToggleCategoryVisibilityAction
} from "../../../reducers/layers.reducer";
import { POINTS_OF_INTEREST, POINTS_OF_INTEREST_CATEGORIES } from "../../../reducers/initial-state";
import type { ApplicationState, Category } from "../../../models";

@Component({
    selector: "points-of-interest-categories",
    templateUrl: "./points-of-interest-categories.component.html",
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatButton, AnalyticsDirective, NgClass]
})
export class PointsOfInterestCategoriesComponent {

    public readonly categories = POINTS_OF_INTEREST_CATEGORIES

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

    private readonly layersState = this.store.selectSignal((s: ApplicationState) => s.layersState);

    public expand() {
        this.store.dispatch(new ExpandGroupAction(POINTS_OF_INTEREST));
    }

    public collapse() {
        this.store.dispatch(new CollapseGroupAction(POINTS_OF_INTEREST));
    }

    public getExpandState(): boolean {
        return this.layersState().expanded.find(l => l === POINTS_OF_INTEREST) != null;
    }

    public toggleCategory(category: Category) {
        this.store.dispatch(new ToggleCategoryVisibilityAction(category.name));
    }

    public toggleVisibility(event: Event) {
        event.stopPropagation();
        this.store.dispatch(new TogglePoisCategoriesVisibilityAction());
    }

    public isCategoryVisible(category: Category): boolean {
        return this.layersState().visiblePoisCategories.includes(category.name);
    }

    public isCategoryGroupVisible(): boolean {
        return this.layersState().visiblePoisCategories.length > 0;
    }
}
