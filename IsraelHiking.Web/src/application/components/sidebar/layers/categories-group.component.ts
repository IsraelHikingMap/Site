import { Component, inject, input } from "@angular/core";
import { MatExpansionPanel, MatExpansionPanelHeader } from "@angular/material/expansion";
import { MatButton } from "@angular/material/button";
import { NgClass } from "@angular/common";
import { Store } from "@ngxs/store";

import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { ResourcesService } from "../../../services/resources.service";
import {
    CollapseGroupAction,
    ExpandGroupAction,
    ToggleCategoriesGroupVisibilityAction,
    ToggleCategoryVisibilityAction
} from "../../../reducers/layers.reducer";
import type { ApplicationState, CategoriesGroup, Category } from "../../../models";

@Component({
    selector: "categories-group",
    templateUrl: "./categories-group.component.html",
    imports: [MatExpansionPanel, MatExpansionPanelHeader, MatButton, Angulartics2OnModule, NgClass]
})
export class CategoriesGroupComponent {

    public categoriesGroup = input<CategoriesGroup>();

    public readonly resources = inject(ResourcesService);

    private readonly store = inject(Store);

    public expand() {
        this.store.dispatch(new ExpandGroupAction(this.categoriesGroup().type));
    }

    public collapse() {
        this.store.dispatch(new CollapseGroupAction(this.categoriesGroup().type));
    }

    public getExpandState(): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.layersState)
            .expanded.find(l => l === this.categoriesGroup().type) != null;
    }

    public toggleCategory(category: Category) {
        this.store.dispatch(new ToggleCategoryVisibilityAction(category.name, this.categoriesGroup().type));
    }

    public toggleVisibility(event: Event) {
        event.stopPropagation();
        this.store.dispatch(new ToggleCategoriesGroupVisibilityAction(this.categoriesGroup().type));
    }

    public isCategoryVisible(category: Category): boolean {
        const layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        return layersState.visibleCategories.find(c => c.name === category.name && this.categoriesGroup().type == c.groupType) != null;
    }

    public isCategoryGroupVisible(): boolean {
        const layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        return layersState.visibleCategories.some(c => this.categoriesGroup().type === c.groupType);
    }
}
