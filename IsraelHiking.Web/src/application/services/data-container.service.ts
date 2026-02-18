import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { LayersService } from "./layers.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";
import { ShareUrlsService } from "./share-urls.service";
import { SelectedRouteService } from "./selected-route.service";
import { MapService } from "./map.service";
import { RoutesFactory } from "./routes.factory";
import { RunningContextService } from "./running-context.service";
import { BulkReplaceRoutesAction } from "../reducers/routes.reducer";
import { SetFileUrlAndBaseLayerAction } from "../reducers/in-memory.reducer";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import type { DataContainer, ApplicationState, LayerData, RouteData, RouteDataWithoutState } from "../models";

@Injectable()
export class DataContainerService {

    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly layersService = inject(LayersService);
    private readonly fileService = inject(FileService);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly mapService = inject(MapService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);

    public setData(dataContainer: Immutable<DataContainer>, keepCurrentRoutes: boolean) {
        let routesData: RouteData[] = [];
        for (const route of dataContainer.routes) {
            const routeToAdd = this.routesFactory.createRouteDataAddMissingFields(route, this.selectedRouteService.getLeastUsedColor());
            routesData.push(routeToAdd);
        }
        const selectedRouteId = routesData.length > 0 ? routesData[0].id : null; // the default is the first newly added route
        if (keepCurrentRoutes) {
            const currentRoutes = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.routes).present) as RouteData[];
            routesData = [...currentRoutes, ...routesData];
        }
        this.routesFactory.regenerateDuplicateIds(routesData);
        this.store.dispatch(new BulkReplaceRoutesAction(routesData));
        if (selectedRouteId) {
            this.store.dispatch(new SetSelectedRouteAction(selectedRouteId));
        }

        if (dataContainer.northEast != null && dataContainer.southWest != null) {
            this.mapService.fitBounds({ northEast: dataContainer.northEast, southWest: dataContainer.southWest }, true);
        }
    }

    public getContainerForRoutes(routes: Immutable<RouteDataWithoutState[]>): DataContainer {
        const layersContainer = this.layersService.getData();

        const bounds = this.mapService.getMapBounds();
        const container: DataContainer = {
            routes: structuredClone(routes) as RouteDataWithoutState[],
            baseLayer: layersContainer.baseLayer,
            overlays: layersContainer.overlays,
            northEast: bounds.northEast,
            southWest: bounds.southWest
        };
        return container;
    }

    public async setFileUrlAfterNavigation(url: string, baseLayer: string) {
        if (this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState.fileUrl) === url) {
            return;
        }
        try {
            const data = await this.fileService.openFromUrl(url);
            this.store.dispatch(new SetFileUrlAndBaseLayerAction(url, baseLayer));
            data.baseLayer = this.stringToBaseLayer(baseLayer);
            this.setData(data, this.runningContextService.isCapacitor);
        } catch {
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
            this.toastService.error(ex, this.resources.unableToLoadFromUrl);
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
