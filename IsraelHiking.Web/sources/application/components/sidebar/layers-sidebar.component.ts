import { Component, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material";
import { select, NgRedux } from "@angular-redux/store";
import { Observable } from "rxjs";
import { every, some } from "lodash";

import { SidebarService } from "../../services/sidebar.service";
import { LayersService } from "../../services/layers/layers.service";
import { ResourcesService } from "../../services/resources.service";
import { BaseMapComponent } from "../base-map.component";
import { BaseLayerAddDialogComponent } from "../dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "../dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "../dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "../dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "../dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "../dialogs/routes/route-edit-dialog.component";
import { CategoriesLayerFactory } from "../../services/layers/categories-layers.factory";
import { PoiService, CategoriesType, ICategory } from "../../services/poi.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SetSelectedRouteAction } from "../../reducres/route-editing-state.reducer";
import { ApplicationState, RouteData, EditableLayer, Overlay } from "../../models/models";
import { ChangeRoutePropertiesAction, DeleteAllRoutesAction } from "../../reducres/routes.reducer";
import { ToastService } from "../../services/toast.service";
import { ExpandGroupAction, CollapseGroupAction } from "../../reducres/layers.reducer";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class LayersSidebarComponent extends BaseMapComponent {

    public categoriesTypes: CategoriesType[];

    @select((state: ApplicationState) => state.layersState.baseLayers)
    public baseLayers: Observable<EditableLayer[]>;

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.routes.present)
    public routes: Observable<RouteData[]>;

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;


    constructor(resources: ResourcesService,
        private readonly dialog: MatDialog,
        private readonly layersService: LayersService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly sidebarService: SidebarService,
        private readonly poiService: PoiService,
        private ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.categoriesTypes = this.poiService.getCategoriesTypes();
    }

    public closeSidebar() {
        this.sidebarService.hide();
    }

    public addBaseLayer(event: Event) {
        event.stopPropagation();
        this.dialog.open(BaseLayerAddDialogComponent);
    }

    public editBaseLayer(e: Event, layer: EditableLayer) {
        e.stopPropagation();
        let dialogRef = this.dialog.open(BaseLayerEditDialogComponent);
        dialogRef.componentInstance.setBaseLayer(layer);
    }

    public isCategoriesLayerVisible(categoriesType: CategoriesType): boolean {
        return this.categoriesLayerFactory.get(categoriesType).isVisible();
    }

    public toggleCategoriesLayerVisibility(categoriesType: CategoriesType, event: Event) {
        event.stopPropagation();
        let layer = this.categoriesLayerFactory.get(categoriesType);
        if (layer.isVisible()) {
            layer.hide();
        } else {
            layer.show();
        }
    }

    public getCategories(categoriesType: CategoriesType): ICategory[] {
        return this.categoriesLayerFactory.get(categoriesType).categories;
    }

    public expand(group: string) {
        this.ngRedux.dispatch(new ExpandGroupAction({ name: group }));
    }

    public collapse(group: string) {
        this.ngRedux.dispatch(new CollapseGroupAction({ name: group }));
    }

    public getExpandState(group: string): boolean {
        return this.ngRedux.getState().layersState.expanded.find(l => l === group) != null;
    }

    public toggleCategory(categoriesType: CategoriesType, category: ICategory) {
        let layer = this.categoriesLayerFactory.get(categoriesType);
        layer.toggleCategory(category);
        if (layer.isVisible() && every(layer.categories, c => c.visible === false)) {
            layer.hide();
            return;
        }
        if (layer.isVisible() === false && some(layer.categories, c => c.visible)) {
            layer.show();
        }
    }

    public addOverlay(event: Event) {
        event.stopPropagation();
        this.dialog.open(OverlayAddDialogComponent);
    }

    public editOverlay(e: Event, layer: Overlay) {
        e.stopPropagation();
        let dialogRef = this.dialog.open(OverlayEditDialogComponent);
        dialogRef.componentInstance.setOverlay(layer);
    }

    public addRoute(event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteAddDialogComponent);
    }

    public editRoute(routeData: RouteData, event: Event) {
        event.stopPropagation();
        let dialogRef = this.dialog.open(RouteEditDialogComponent);
        dialogRef.componentInstance.setRouteData(routeData);
    }

    public isBaseLayerSelected(baseLayer: EditableLayer): boolean {
        return this.layersService.isBaseLayerSelected(baseLayer);
    }

    public selectBaseLayer(baseLayer: EditableLayer) {
        this.layersService.selectBaseLayer(baseLayer.key);
    }

    public toggleVisibility(overlay: Overlay) {
        this.layersService.toggleOverlay(overlay);
    }

    public toggleRoute(routeData: RouteData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && routeData.id === selectedRoute.id && routeData.state !== "Hidden") {
            this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: null }));
            routeData.state = "Hidden";
            this.ngRedux.dispatch(new ChangeRoutePropertiesAction(
                {
                    routeId: routeData.id,
                    routeData: routeData
                }));
            return;
        }
        if (routeData.state === "Hidden") {
            routeData.state = "ReadOnly";
            this.ngRedux.dispatch(new ChangeRoutePropertiesAction(
                {
                    routeId: routeData.id,
                    routeData: routeData
                }));
        }
        this.selectedRouteService.setSelectedRoute(routeData.id);
    }

    public isRouteVisible(routeData: RouteData) {
        return routeData.state !== "Hidden";
    }

    public isRouteSelected(routeData: RouteData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === routeData.id;
    }
}