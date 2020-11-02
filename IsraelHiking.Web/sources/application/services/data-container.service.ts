import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { LayersService } from "./layers/layers.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ShareUrlsService } from "./share-urls.service";
import { SpatialService } from "./spatial.service";
import { FitBoundsService } from "./fit-bounds.service";
import { BulkReplaceRoutesAction } from "../reducres/routes.reducer";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { MapService } from "./map.service";
import { RoutesFactory } from "./layers/routelayers/routes.factory";
import { RunningContextService } from "./running-context.service";
import { SetFileUrlAndBaseLayerAction } from "../reducres/in-memory.reducer";
import { SetSelectedRouteAction } from "../reducres/route-editing-state.reducer";
import { DataContainer, ApplicationState, LayerData } from "../models/models";

@Injectable()
export class DataContainerService {

    constructor(private readonly shareUrlsService: ShareUrlsService,
                private readonly layersService: LayersService,
                private readonly fileService: FileService,
                private readonly resourcesService: ResourcesService,
                private readonly toastService: ToastService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routesFactory: RoutesFactory,
                private readonly mapService: MapService,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public setData(dataContainer: DataContainer, keepCurrentRoutes: boolean) {
        let routesData = [];
        for (let route of dataContainer.routes) {
            let routeToAdd = this.routesFactory.createRouteDataAddMissingFields(route, this.selectedRouteService.getLeastUsedColor());
            routesData.push(routeToAdd);
        }
        if (keepCurrentRoutes) {
            routesData = [...this.ngRedux.getState().routes.present, ...routesData];
        }
        this.ngRedux.dispatch(new BulkReplaceRoutesAction({
            routesData
        }));
        if (routesData.length > 0 && this.selectedRouteService.getSelectedRoute() == null) {
            this.ngRedux.dispatch(new SetSelectedRouteAction({
                routeId: routesData[0].id
            }));
        }
        this.layersService.addExternalOverlays(dataContainer.overlays);
        this.layersService.addExternalBaseLayer(dataContainer.baseLayer);

        if (dataContainer.northEast != null && dataContainer.southWest != null) {
            this.fitBoundsService.fitBounds({northEast: dataContainer.northEast, southWest: dataContainer.southWest}, true);
        }
    }

    public getData(): DataContainer {
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

    public async setFileUrlAfterNavigation(url: string, baseLayer: string) {
        try {
            let data = await this.fileService.openFromUrl(url);
            this.ngRedux.dispatch(new SetFileUrlAndBaseLayerAction({
                fileUrl: url,
                baseLayer
            }));
            data.baseLayer = this.stringToBaseLayer(baseLayer);
            this.setData(data, this.runningContextService.isCordova);
        } catch (ex) {
            this.toastService.warning(this.resourcesService.unableToLoadFromUrl);
        }
    }

    public async setShareUrlAfterNavigation(shareId) {
        let shareUrl = this.shareUrlsService.getSelectedShareUrl();
        if (shareUrl && shareUrl.id === shareId) {
            return;
        }
        try {
            shareUrl = await this.shareUrlsService.setShareUrlById(shareId);
            this.setData(shareUrl.dataContainer, this.runningContextService.isCordova);
            if (!this.runningContextService.isIFrame) {
                this.toastService.info(shareUrl.description, shareUrl.title);
            }
        } catch (ex) {
            this.shareUrlsService.setShareUrl(null);
            this.toastService.warning(this.resourcesService.unableToLoadFromUrl);
        }
    }

    private stringToBaseLayer(addressOrKey: string): LayerData {
        if (!addressOrKey) {
            return null;
        }
        if (addressOrKey.includes("www") || addressOrKey.includes("http")) {
            return {
                key: "",
                address: addressOrKey
            } as LayerData;
        }
        return {
            key: addressOrKey.split("_").join(" "),
            address: ""
        } as LayerData;
    }
}
