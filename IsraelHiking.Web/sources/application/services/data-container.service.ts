import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import * as L from "leaflet";

import { LayersService } from "./layers/layers.service";
import { RoutesService } from "./layers/routelayers/routes.service";
import { MapService } from "./map.service";
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { HashService } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { Deferred } from "../common/deferred";
import * as Common from "../common/IsraelHiking";
import { Urls } from "../common/Urls";


@Injectable()
export class DataContainerService {
    public initializationFinished: Promise<any>;

    constructor(private http: Http,
        private layersService: LayersService,
        private routesService: RoutesService,
        private mapService: MapService,
        private hashService: HashService,
        private fileService: FileService,
        private resourcesService: ResourcesService,
        private toastService: ToastService) {

        let deferred = new Deferred<any>();
        this.initializationFinished = deferred.promise;
        this.layersService.initializationFinished.then(
            () => this.addDataFromHash(deferred),
            () => this.addDataFromHash(deferred)
        );
        
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

    private addDataFromHash = (deferred: Deferred<any>) => {
        if (this.hashService.siteUrl) {
            this.http.get(Urls.urls + this.hashService.siteUrl).toPromise()
                .then((response) => {
                    let siteUrl = response.json() as Common.SiteUrl;
                    let data = JSON.parse(siteUrl.jsonData) as Common.DataContainer;
                    this.setInitialData(data);
                    this.toastService.info(siteUrl.description, siteUrl.title);
                    deferred.resolve();
                }, () => {
                    this.hashService.siteUrl = "";
                    this.toastService.warning(this.resourcesService.unableToLoadFromUrl);
                    deferred.resolve();
                });
            return;
        }
        if (this.hashService.externalUrl) {
            this.fileService.openFromUrl(this.hashService.externalUrl)
                .then((response) => {
                    let data = response.json() as Common.DataContainer;
                    data.baseLayer = this.hashService.getBaseLayer();
                    this.setInitialData(data);
                    deferred.resolve();
                }, () => {
                    deferred.reject();
                });
        } else {
            this.layersService.addExternalBaseLayer(this.hashService.getBaseLayer());
            deferred.resolve();
        }
    }

    /**
     * This method assums it is being called when the application loads
     * so there's only one route in the routes layer - and it needs to be removed if other route is loaded.
     * @param data
     */
    private setInitialData(data: Common.DataContainer) {
        if (data.routes && data.routes.length !== 0) {
            this.routesService.removeRoute(this.routesService.selectedRoute.route.properties.name);
        }
        this.setData(data);
    }
}