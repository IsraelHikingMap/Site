import { Component, Input } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import {
    ExpandGroupAction,
    CollapseGroupAction,
    SetCategoryVisibilityAction,
    SetCategoriesGroupVisibilityAction
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
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public expand() {
        this.ngRedux.dispatch(new ExpandGroupAction({ name: this.categoriesGroup.type }));
    }

    public collapse() {
        this.ngRedux.dispatch(new CollapseGroupAction({ name: this.categoriesGroup.type }));
    }

    public getExpandState(): boolean {
        return this.ngRedux.getState().layersState.expanded.find(l => l === this.categoriesGroup.type) != null;
    }

    public toggleCategory(category: Category) {
        this.ngRedux.dispatch(new SetCategoryVisibilityAction({
            groupType: this.categoriesGroup.type,
            name: category.name,
            visible: !category.visible
        }));
    }

    public toggleVisibility(event: Event) {
        event.stopPropagation();
        this.ngRedux.dispatch(new SetCategoriesGroupVisibilityAction({
            groupType: this.categoriesGroup.type,
            visible: !this.categoriesGroup.visible
        }));
    }
}
