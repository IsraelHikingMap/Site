import { Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

import { LayersService } from "./layers.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ShareUrlsService } from "./share-urls.service";
import { SpatialService } from "./spatial.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SelectedRouteService } from "./selected-route.service";
import { MapService } from "./map.service";
import { RoutesFactory } from "./routes.factory";
import { RunningContextService } from "./running-context.service";
import { BulkReplaceRoutesAction } from "../reducers/routes.reducer";
import { SetFileUrlAndBaseLayerAction } from "../reducers/in-memory.reducer";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import type { DataContainer, ApplicationState, LayerData } from "../models/models";

@Injectable()
export class DataContainerService {

    constructor(private readonly shareUrlsService: ShareUrlsService,
                private readonly layersService: LayersService,
                private readonly fileService: FileService,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routesFactory: RoutesFactory,
                private readonly mapService: MapService,
                private readonly runningContextService: RunningContextService,
                private readonly store: Store) {
    }

    public setData(dataContainer: DataContainer, keepCurrentRoutes: boolean) {
        let routesData = [];
        for (const route of dataContainer.routes) {
            const routeToAdd = this.routesFactory.createRouteDataAddMissingFields(route, this.selectedRouteService.getLeastUsedColor());
            routesData.push(routeToAdd);
        }
        if (keepCurrentRoutes) {
            const currentRoutes = this.store.selectSnapshot((s: ApplicationState) => s.routes).present;
            routesData = [...currentRoutes, ...routesData];
        }
        this.routesFactory.regenerateDuplicateIds(routesData);
        this.store.dispatch(new BulkReplaceRoutesAction(routesData));
        if (routesData.length > 0 && this.selectedRouteService.getSelectedRoute() == null) {
            this.store.dispatch(new SetSelectedRouteAction(routesData[0].id));
        }
        this.layersService.addExternalOverlays(dataContainer.overlays);
        this.layersService.addExternalBaseLayer(dataContainer.baseLayer);

        if (dataContainer.northEast != null && dataContainer.southWest != null) {
            this.fitBoundsService.fitBounds({northEast: dataContainer.northEast, southWest: dataContainer.southWest}, true);
        }
    }

    public getData(withHidden: boolean): DataContainer {
        const layersContainer = this.layersService.getData();

        const bounds = SpatialService.getMapBounds(this.mapService.map);
        const routes = this.store.selectSnapshot((s: ApplicationState) => s.routes).present
            .filter(r => r.state !== "Hidden" || withHidden)
            .filter(r => r.segments.length > 0 || r.markers.length > 0);
        const container = {
            routes,
            baseLayer: layersContainer.baseLayer,
            overlays: layersContainer.overlays,
            northEast: bounds.northEast,
            southWest: bounds.southWest
        } as DataContainer;
        return container;
    }

    public getDataForFileExport(): DataContainer {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return this.getData(false);
        }
        return {
            routes: [selectedRoute]
        } as DataContainer;
    }

    public async setFileUrlAfterNavigation(url: string, baseLayer: string) {
        try {
            const data = await this.fileService.openFromUrl(url);
            this.store.dispatch(new SetFileUrlAndBaseLayerAction(url, baseLayer));
            data.baseLayer = this.stringToBaseLayer(baseLayer);
            this.setData(data, this.runningContextService.isCapacitor);
        } catch (ex) {
            this.toastService.warning(this.resources.unableToLoadFromUrl);
        }
    }

    public async setShareUrlAfterNavigation(shareId: string) {
        let shareUrl = this.shareUrlsService.getSelectedShareUrl();
        if (shareUrl && shareUrl.id === shareId) {
            return;
        }
        try {
            shareUrl = await this.shareUrlsService.setShareUrlById(shareId);
            this.setData(shareUrl.dataContainer, this.runningContextService.isCapacitor);
            if (!this.runningContextService.isIFrame) {
                this.toastService.info(shareUrl.description, shareUrl.title);
            }
        } catch (ex) {
            this.shareUrlsService.setShareUrl(null);
            this.toastService.warning(this.resources.unableToLoadFromUrl);
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

    public hasHiddenRoutes(): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.routes).present.filter(r => r.state === "Hidden").length > 0;
    }
}
