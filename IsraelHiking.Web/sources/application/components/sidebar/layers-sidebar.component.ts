import { Component, ViewEncapsulation, OnDestroy } from "@angular/core";
import { MatDialog } from "@angular/material";
import { LocalStorage } from "ngx-store";
import * as _ from "lodash";

import { MapService } from "../../services/map.service";
import { FileService } from "../../services/file.service";
import { SidebarService } from "../../services/sidebar.service";
import { LayersService, IBaseLayer, IOverlay } from "../../services/layers/layers.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { IRouteLayer } from "../../services/layers/routelayers/iroute.layer";
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

interface ICategoriesContainer {
    categories: ICategory[];
    isExpanded: boolean;
}

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class LayersSidebarComponent extends BaseMapComponent implements OnDestroy {
    public baseLayers: IBaseLayer[];
    public overlays: IOverlay[];
    public routes: IRouteLayer[];
    public categoriesTypes: CategoriesType[];

    private categoriesMap: Map<CategoriesType, ICategoriesContainer>;

    @LocalStorage()
    public isAdvanced: boolean = false;

    constructor(resources: ResourcesService,
        private dialog: MatDialog,
        private mapService: MapService,
        private layersService: LayersService,
        private routesService: RoutesService,
        private categoriesLayerFactory: CategoriesLayerFactory,
        private fileService: FileService,
        private sidebarService: SidebarService,
        private poiService: PoiService) {
        super(resources);
        this.baseLayers = layersService.baseLayers;
        this.overlays = layersService.overlays;
        this.routes = routesService.routes;
        this.categoriesTypes = this.poiService.getCategoriesTypes();
        this.categoriesMap = new Map<CategoriesType, ICategoriesContainer>();
        for (let categoriesType of this.categoriesTypes) {
            this.categoriesMap.set(categoriesType, {
                categories: this.categoriesLayerFactory.get(categoriesType).categories,
                // HM TODO: store in local storage?
                isExpanded: false
            });
        }
    }

    public ngOnDestroy() {
        // this is required in order for local storage to work properly.
    }

    public closeSidebar() {
        this.sidebarService.hide();
    }

    public addBaseLayer(e: Event) {
        this.suppressEvents(e);
        this.dialog.open(BaseLayerAddDialogComponent);
    }

    public editBaseLayer(layer: IBaseLayer, e: Event) {
        this.suppressEvents(e);
        let dialogRef = this.dialog.open(BaseLayerEditDialogComponent);
        dialogRef.componentInstance.setBaseLayer(layer);
    }

    public isCategoriesLayerVisible(categoriesType: CategoriesType): boolean {
        return this.categoriesLayerFactory.get(categoriesType).isVisible();
    }

    public toggleCategoriesLayerVisibility(categoriesType: CategoriesType, e: Event) {
        this.suppressEvents(e);
        let layer = this.categoriesLayerFactory.get(categoriesType);
        if (layer.isVisible()) {
            this.mapService.map.removeLayer(layer);
        } else {
            this.mapService.map.addLayer(layer);
        }
    }

    public getCategories(categoriesType: CategoriesType): ICategory[] {
        return this.categoriesMap.get(categoriesType).categories;
    }

    public isCategoriesVisible(categoriesType: CategoriesType) {
        return this.categoriesMap.get(categoriesType).isExpanded;
    }

    public toggleCategories(categoriesType: CategoriesType, e: Event) {
        this.suppressEvents(e);
        this.categoriesMap.get(categoriesType).isExpanded = ! this.categoriesMap.get(categoriesType).isExpanded;
    }

    public toggleCategory(categoriesType: CategoriesType, category: ICategory, e: Event) {
        this.suppressEvents(e);
        let layer = this.categoriesLayerFactory.get(categoriesType);
        layer.toggleCategory(category);
        if (layer.isVisible() && _.every(layer.categories, c => c.isSelected === false)) {
            this.mapService.map.removeLayer(layer);
            return;
        }
        if (layer.isVisible() === false && _.some(layer.categories, c => c.isSelected)) {
            this.mapService.map.addLayer(layer);
        }
    }

    public addOverlay(e: Event) {
        this.suppressEvents(e);
        let dialogRef = this.dialog.open(OverlayAddDialogComponent);
        dialogRef.componentInstance.setIsAdvanced(this.isAdvanced);
    }

    public editOverlay(layer: IOverlay, e: Event) {
        this.suppressEvents(e);
        let dialogRef = this.dialog.open(OverlayEditDialogComponent);
        dialogRef.componentInstance.setIsAdvanced(this.isAdvanced);
        dialogRef.componentInstance.setOverlay(layer);
    }

    public addRoute(e: Event) {
        this.suppressEvents(e);
        let dialogRef = this.dialog.open(RouteAddDialogComponent);
        dialogRef.componentInstance.setIsAdvanced(this.isAdvanced);
    }

    public editRoute(routeName: string, e: Event) {
        this.suppressEvents(e);
        let dialogRef = this.dialog.open(RouteEditDialogComponent);
        dialogRef.componentInstance.setIsAdvanced(this.isAdvanced);
        dialogRef.componentInstance.setRouteLayer(routeName);
    }

    public selectBaseLayer(baseLayer: IBaseLayer, e: Event) {
        this.layersService.selectBaseLayer(baseLayer);
        this.suppressEvents(e);
    }

    public toggleVisibility(overlay: IOverlay, e: Event) {
        this.layersService.toggleOverlay(overlay);
        this.suppressEvents(e);
    }

    public selectRoute (routeLayer: IRouteLayer, e: Event) {
        this.routesService.changeRouteState(routeLayer);
        this.suppressEvents(e);
    }

    public toggleShow(e: Event) {
        this.sidebarService.toggle("layers");
        this.suppressEvents(e);
    }

    public isVisisble(): boolean {
        return this.sidebarService.viewName === "layers";
    }

    public getRouteColor(routeLayer: IRouteLayer) {
        return routeLayer.route.properties.pathOptions.color;
    }

    public getRouteName = (routeLayer: IRouteLayer) => {
        return routeLayer.route.properties.name;
    }

    public getRouteDescription = (routeLayer: IRouteLayer) => {
        return routeLayer.route.properties.description;
    }

    public isRouteVisisble(routeLayer: IRouteLayer) {
        return routeLayer.route.properties.isVisible;
    }

    public isRouteSelected(routeLayer: IRouteLayer) {
        return this.routesService.selectedRoute === routeLayer;
    }
} 