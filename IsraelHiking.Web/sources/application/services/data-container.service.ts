import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { LayersService } from "./layers/layers.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { HashService, RouteStrings } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { ShareUrlsService } from "./share-urls.service";
import { SpatialService } from "./spatial.service";
import { ShareUrl, DataContainer, ApplicationState, RouteData } from "../models/models";
import { FitBoundsService } from "./fit-bounds.service";
import { AddRouteAction } from "../reducres/routes.reducer";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { MapService } from "./map.service";
import { RouteLayerFactory } from "./layers/routelayers/route-layer.factory";


@Injectable()
export class DataContainerService {

    private shareUrl: ShareUrl;
    // private layersInitializationPromise: Promise<any>;

    constructor(
        private readonly router: Router,
        private readonly shareUrlsService: ShareUrlsService,
        private readonly layersService: LayersService,
        private readonly hashService: HashService,
        private readonly fileService: FileService,
        private readonly resourcesService: ResourcesService,
        private readonly toastService: ToastService,
        private readonly fitBoundsService: FitBoundsService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly mapService: MapService,
        private readonly ngRedux: NgRedux<ApplicationState>) {

        this.shareUrl = null;
    }

    private setData(dataContainer: DataContainer) {
        for (let route of dataContainer.routes) {
            let routeToAdd = this.routeLayerFactory.createRouteDataAddMissingFields(route);
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: routeToAdd
            }));
        }
        this.layersService.addExternalOverlays(dataContainer.overlays);
        this.layersService.addExternalBaseLayer(dataContainer.baseLayer);

        if (dataContainer.northEast != null && dataContainer.southWest != null) {
            this.fitBoundsService.fitBounds({northEast: dataContainer.northEast, southWest: dataContainer.southWest});
        }
    }

    public getData = (): DataContainer => {
        let layersContainer = this.layersService.getData();

        let bounds = SpatialService.getMapBounds(this.mapService.map);

        let container = {
            routes: this.ngRedux.getState().routes.present,
            baseLayer: layersContainer.baseLayer,
            overlays: layersContainer.overlays,
            northEast: bounds.northEast,
            southWest: bounds.southWest
        } as DataContainer;
        return container;
    }

    public getDataForFileExport(): DataContainer {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return this.getData();
        }
        return {
            routes: [selectedRoute]
        } as DataContainer;
    }

    public initialize = async () => {
        // HM TODO: make sure this is working properly
        // this.layersInitializationPromise = this.layersService.initialize();
        // await this.layersInitializationPromise;
        // This assumes hashservice has already finished initialization, this assumption can cause bugs...
        // HM TODO: get base layer from store
        this.layersService.addExternalBaseLayer(this.hashService.getBaselayer());
    }

    public setFileUrlAfterNavigation = async (url: string, baseLayer: string) => {
        // await this.layersInitializationPromise;
        this.hashService.setApplicationState("baseLayer", baseLayer);
        this.hashService.setApplicationState("url", url);
        let data = await this.fileService.openFromUrl(url);
        data.baseLayer = this.hashService.stringToBaseLayer(baseLayer);
        this.setData(data);
    }

    public setShareUrlAfterNavigation = async (shareId) => {
        if (this.shareUrl && this.shareUrl.id === shareId) {
            return;
        }
        // await this.layersInitializationPromise;
        try {
            this.hashService.setApplicationState("share", shareId);
            let shareUrl = await this.shareUrlsService.getShareUrl(shareId);
            this.setData(shareUrl.dataContainer);
            this.shareUrl = shareUrl;
            if (window.self === window.top) {
                this.toastService.info(shareUrl.description, shareUrl.title);
            }
        } catch (ex) {
            this.hashService.setApplicationState("share", "");
            this.toastService.warning(this.resourcesService.unableToLoadFromUrl);
        }
    }

    public getShareUrl(): ShareUrl {
        return this.shareUrl;
    }

    public setShareUrl(shareUrl: ShareUrl) {
        this.shareUrl = shareUrl;
        this.router.navigate([RouteStrings.ROUTE_SHARE, this.shareUrl.id]);
    }
}