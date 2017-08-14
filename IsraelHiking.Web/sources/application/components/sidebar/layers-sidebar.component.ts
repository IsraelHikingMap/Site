import { Component, ViewEncapsulation } from "@angular/core";
import { MdDialog } from "@angular/material";
import { LocalStorage } from "ngx-store";
import { MapService } from "../../services/map.service";
import { FileService } from "../../services/file.service";
import { SidebarService } from "../../services/sidebar.service";
import { LayersService, IBaseLayer, IOverlay } from "../../services/layers/layers.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { IRouteLayer } from "../../services/layers/routelayers/iroute.layer";
import { ResourcesService } from "../../services/resources.service";
import { PoiLayer, IFilter } from "../../services/layers/poi.layer";
import { BaseMapComponent } from "../base-map.component";
import { BaseLayerAddDialogComponent } from "../dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "../dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "../dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "../dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "../dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "../dialogs/routes/route-edit-dialog.component";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.css"],
    encapsulation: ViewEncapsulation.None
})
export class LayersSidebarComponent extends BaseMapComponent {
    public baseLayers: IBaseLayer[];
    public overlays: IOverlay[];
    public routes: IRouteLayer[];
    public filters: IFilter[];

    public isPoisFiltersVisible: boolean = false;

    @LocalStorage()
    public isAdvanced: boolean = false;

    constructor(resources: ResourcesService,
        private dialog: MdDialog,
        private mapService: MapService,
        private layersService: LayersService,
        private routesService: RoutesService,
        private poiLayer: PoiLayer,
        private fileService: FileService,
        private sidebarService: SidebarService) {
        super(resources);
        this.baseLayers = layersService.baseLayers;
        this.overlays = layersService.overlays;
        this.routes = routesService.routes;
        this.filters = poiLayer.filters;
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

    public togglePoisVisibility(e: Event) {
        this.suppressEvents(e);
        if (this.layersService.isPoisVisible) {
            this.mapService.map.removeLayer(this.poiLayer);
        } else {
            this.mapService.map.addLayer(this.poiLayer);
        }
        this.layersService.isPoisVisible = !this.layersService.isPoisVisible;
    }

    public togglePoisFilters(e: Event) {
        this.suppressEvents(e);
        this.isPoisFiltersVisible = !this.isPoisFiltersVisible;
    }

    public toggleFilter(filter: IFilter, e: Event) {
        this.suppressEvents(e);
        this.poiLayer.toggleFilter(filter);
    }

    public addOverlay(e: Event) {
        this.suppressEvents(e);
        this.dialog.open(OverlayAddDialogComponent);
    }

    public editOverlay(layer: IOverlay, e: Event) {
        this.suppressEvents(e);
        let dialogRef = this.dialog.open(OverlayEditDialogComponent);
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