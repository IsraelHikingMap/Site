import { Component, Input } from "@angular/core";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import {
    CollapseGroupAction,
    ExpandGroupAction,
    SetCategoriesGroupVisibilityAction,
    SetCategoryVisibilityAction
} from "../../reducers/layers.reducer";
import type { ApplicationState, CategoriesGroup, Category } from "../../models/models";

@Component({
    selector: "categories-group",
    templateUrl: "./categories-group.component.html"
})
export class CategoriesGroupComponent extends BaseMapComponent {

    @Input()
    public categoriesGroup: CategoriesGroup;

    constructor(resources: ResourcesService,
                private readonly store: Store) {
        super(resources);
    }

    public expand() {
        this.store.dispatch(new ExpandGroupAction(this.categoriesGroup.type));
    }

    public collapse() {
        this.store.dispatch(new CollapseGroupAction(this.categoriesGroup.type));
    }

    public getExpandState(): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.layersState)
            .expanded.find(l => l === this.categoriesGroup.type) != null;
    }

    public toggleCategory(category: Category) {
        this.store.dispatch(new SetCategoryVisibilityAction(category.name, this.categoriesGroup.type, !category.visible));
    }

    public toggleVisibility(event: Event) {
        event.stopPropagation();
        this.store.dispatch(new SetCategoriesGroupVisibilityAction(this.categoriesGroup.type, !this.categoriesGroup.visible));
    }
}
