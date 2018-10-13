import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import * as _ from "lodash";
import { Map, proj } from "openlayers";

import { LayersService } from "./layers/layers.service";
import { RoutesService } from "./layers/routelayers/routes.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { HashService, RouteStrings } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { OsmUserService } from "./osm-user.service";
import { SpatialService } from "./spatial.service";
import { ShareUrl, DataContainer } from "../models/models";

@Injectable()
export class DataContainerService {

    private map: Map;
    private shareUrl: ShareUrl;
    private layersInitializationPromise: Promise<any>;

    constructor(
        private readonly router: Router,
        private readonly osmUserService: OsmUserService,
        private readonly layersService: LayersService,
        private readonly routesService: RoutesService,
        private readonly hashService: HashService,
        private readonly fileService: FileService,
        private readonly resourcesService: ResourcesService,
        private readonly toastService: ToastService) {

        this.shareUrl = null;
    }

    public setMap(map: Map) {
        this.map = map;
    }

    public setData(dataContainer: DataContainer) {
        this.routesService.setData(dataContainer.routes);
        this.layersService.addExternalOverlays(dataContainer.overlays);
        this.layersService.addExternalBaseLayer(dataContainer.baseLayer);

        if (dataContainer.northEast != null && dataContainer.southWest != null) {
            // HM TODO: fit bounds
            //this.mapService.map.fitBounds(L.latLngBounds(dataContainer.southWest, dataContainer.northEast));
        }
    }

    public getData = (): DataContainer => {
        let layersContainer = this.layersService.getData();

        let bounds = SpatialService.getMapBounds(this.map);

        let container = {
            routes: this.routesService.getData(),
            baseLayer: layersContainer.baseLayer,
            overlays: layersContainer.overlays,
            northEast: bounds.northEast,
            southWest: bounds.southWest
        } as DataContainer;
        return container;
    }

    public getDataForFileExport(): DataContainer {
        if (this.routesService.selectedRoute == null) {
            return this.getData();
        }
        return {
            routes: [this.routesService.selectedRoute.getData()]
        } as DataContainer;
    }

    public initialize = async () => {
        this.layersInitializationPromise = this.layersService.initialize();
        await this.layersInitializationPromise;
        // This assumes hashservice has already finished initialization, this assumption can cause bugs...
        this.layersService.addExternalBaseLayer(this.hashService.getBaselayer());
    }

    public setFileUrlAfterNavigation = async (url: string, baseLayer: string) => {
        await this.layersInitializationPromise;
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
        await this.layersInitializationPromise;
        try {
            this.hashService.setApplicationState("share", shareId);
            let shareUrl = await this.osmUserService.getShareUrl(shareId);
            this.setData(shareUrl.dataContainer);
            // hide overlays that are not part of the share:
            for (let overlay of this.layersService.overlays) {
                let overlayInShare = _.find(shareUrl.dataContainer.overlays || [],
                    o => o.key === overlay.key || o.address === overlay.address);
                if (overlayInShare == null && overlay.visible) {
                    this.layersService.toggleOverlay(overlay);
                }
            }
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