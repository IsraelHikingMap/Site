import { Injectable } from "@angular/core";
import * as L from "leaflet";

import { LayersService } from "./layers/layers.service";
import { RoutesService } from "./layers/routelayers/routes.service";
import { MapService } from "./map.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { HashService } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { OsmUserService } from "./osm-user.service";
import * as Common from "../common/IsraelHiking";

@Injectable()
export class DataContainerService {
    public shareUrlId: string;

    constructor(
        private readonly osmUserService: OsmUserService,
        private readonly layersService: LayersService,
        private readonly routesService: RoutesService,
        private readonly mapService: MapService,
        private readonly hashService: HashService,
        private readonly fileService: FileService,
        private readonly resourcesService: ResourcesService,
        private readonly toastService: ToastService) {

        this.shareUrlId = "";
    }

    public setData(dataContainer: Common.DataContainer) {
        this.routesService.setData(dataContainer.routes);
        this.layersService.addExternalOverlays(dataContainer.overlays);
        this.layersService.addExternalBaseLayer(dataContainer.baseLayer);

        if (dataContainer.northEast != null && dataContainer.southWest != null) {
            this.mapService.map.fitBounds(L.latLngBounds(dataContainer.southWest, dataContainer.northEast));
        }
    }

    public getData = (): Common.DataContainer => {
        var layersContainer = this.layersService.getData();

        var container = {
            routes: this.routesService.getData(),
            baseLayer: layersContainer.baseLayer,
            overlays: layersContainer.overlays,
            northEast: this.mapService.map.getBounds().getNorthEast(),
            southWest: this.mapService.map.getBounds().getSouthWest()
        } as Common.DataContainer;
        return container;
    }

    public getDataForFileExport(): Common.DataContainer {
        if (this.routesService.selectedRoute == null) {
            return this.getData();
        }
        return {
            routes: [this.routesService.selectedRoute.getData()]
        } as Common.DataContainer;
    }

    public initialize = async () => {
        await this.layersService.initialize();
        if (this.hashService.shareUrl) {
            try {
                let shareUrl = await this.osmUserService.getShareUrl(this.hashService.shareUrl);
                this.setData(shareUrl.dataContainer);
                this.shareUrlId = shareUrl.id;
                this.toastService.info(shareUrl.description, shareUrl.title);
            } catch (ex) {
                this.hashService.shareUrl = "";
                this.toastService.warning(this.resourcesService.unableToLoadFromUrl);
            }
        }
        else if (this.hashService.externalUrl) {
            let data = await this.fileService.openFromUrl(this.hashService.externalUrl);
            data.baseLayer = this.hashService.getBaseLayer();
            this.setData(data);
        } else {
            this.layersService.addExternalBaseLayer(this.hashService.getBaseLayer());
        }
    }
}