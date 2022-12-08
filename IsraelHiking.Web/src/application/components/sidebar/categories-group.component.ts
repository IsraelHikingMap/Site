import { Component, Input } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { LayersReducer } from "../../reducers/layers.reducer";
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
        this.ngRedux.dispatch(LayersReducer.actions.expandGroup({ name: this.categoriesGroup.type }));
    }

    public collapse() {
        this.ngRedux.dispatch(LayersReducer.actions.collapseGroup({ name: this.categoriesGroup.type }));
    }

    public getExpandState(): boolean {
        return this.ngRedux.getState().layersState.expanded.find(l => l === this.categoriesGroup.type) != null;
    }

    public toggleCategory(category: Category) {
        this.ngRedux.dispatch(LayersReducer.actions.setCategoryVisibility({
            groupType: this.categoriesGroup.type,
            name: category.name,
            visible: !category.visible
        }));
    }

    public toggleVisibility(event: Event) {
        event.stopPropagation();
        this.ngRedux.dispatch(LayersReducer.actions.setCategoriesGroupVisibility({
            groupType: this.categoriesGroup.type,
            visible: !this.categoriesGroup.visible
        }));
    }
}
