import { Injectable } from "@angular/core";
import * as L from "leaflet";
import * as _ from "lodash";

import { LayersService } from "./layers/layers.service";
import { RoutesService } from "./layers/routelayers/routes.service";
import { MapService } from "./map.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { HashService } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { OsmUserService } from "./osm-user.service";
import { CategoriesLayerFactory } from "./layers/categories-layers.factory";
import { PoiService } from "./poi.service";
import * as Common from "../common/IsraelHiking";

@Injectable()
export class DataContainerService {
    private shareUrl: Common.ShareUrl;

    constructor(
        private readonly osmUserService: OsmUserService,
        private readonly layersService: LayersService,
        private readonly routesService: RoutesService,
        private readonly mapService: MapService,
        private readonly hashService: HashService,
        private readonly fileService: FileService,
        private readonly resourcesService: ResourcesService,
        private readonly categoriesLayerFactory: CategoriesLayerFactory,
        private readonly poiService: PoiService,
        private readonly toastService: ToastService) {

        this.shareUrl = null;
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
        let layersContainer = this.layersService.getData();

        let container = {
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
        if (this.hashService.getShareUrlId()) {
            this.initializeShareUrl();
        } else if (this.hashService.externalUrl) {
            let data = await this.fileService.openFromUrl(this.hashService.externalUrl);
            data.baseLayer = this.hashService.getBaseLayer();
            this.setData(data);
        } else if (this.hashService.getPoiSourceAndId()) {
            let poiSrouceAndId = this.hashService.getPoiSourceAndId();
            try {
                let poi = await this.poiService.getPoint(poiSrouceAndId.id, poiSrouceAndId.source);
                let latLng = L.latLng(poi.location.lat, poi.location.lng);
                let bounds = L.latLngBounds([latLng, latLng]);
                this.categoriesLayerFactory.getByPoiType(poi.isRoute).moveToSearchResults(poi, bounds);
            } catch (ex) {
                this.toastService.error(this.resourcesService.unableToFindPoi);
            }
        } else {
            this.layersService.addExternalBaseLayer(this.hashService.getBaseLayer());
        }
    }

    private initializeShareUrl = async () => {
        try {
            let shareUrl = await this.osmUserService.getShareUrl(this.hashService.getShareUrlId());
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
            this.toastService.info(shareUrl.description, shareUrl.title);
        } catch (ex) {
            this.hashService.setShareUrlId("");
            this.toastService.warning(this.resourcesService.unableToLoadFromUrl);
        }
    }

    public getShareUrl(): Common.ShareUrl {
        return this.shareUrl;
    }

    public setShareUrl(shareUrl: Common.ShareUrl) {
        this.shareUrl = shareUrl;
        this.hashService.setShareUrlId(this.shareUrl.id);
    }
}