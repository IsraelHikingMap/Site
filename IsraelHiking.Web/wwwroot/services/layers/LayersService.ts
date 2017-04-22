namespace IsraelHiking.Services.Layers {
    export interface ILayer extends Common.LayerData {
        layer: L.Layer;
        isEditable: boolean;
    }

    export interface IBaseLayer extends ILayer {
        selected: boolean;
    }

    export interface IOverlay extends ILayer {
        visible: boolean;
    }

    export interface IRouteViewOptions {
        pathOptions: L.PathOptions;
        isVisible: boolean;
    }

    export class LayersService extends ObjectWithMap {
        public static ISRAEL_MTB_MAP = "Israel MTB Map";
        public static ISRAEL_HIKING_MAP = "Israel Hiking Map";
        public static GOOGLE_EARTH = "Google Earth";
        public static MIN_ZOOM = 7;
        public static MAX_NATIVE_ZOOM = 16;

        private static MAX_ZOOM = 20;
        private static HIKING_TRAILS = "Hiking Trails";
        private static ATTRIBUTION = "<a href='http://openstreetmap.org' target='_blank'>OpenStreetMap</a> data under <a href='http://opendatacommons.org/licenses/odbl/summary/' target='_blank'>ODbL</a>. ";
        private static MTB_ATTRIBUTION = LayersService.ATTRIBUTION + "Map style courtesy of <a href='http://mtbmap.no'>MTBmap.no.</a> ";
        private static BASE_LAYERS_KEY = "BaseLayers";
        private static OVERLAYS_KEY = "Overlays";
        private static ACTIVE_BASELAYER_KEY = "ActiveBaseLayer";
        private static ACTIVE_OVERLAYS_KEY = "ActiveOverlays";
        private static CUSTOM_LAYER = "Custom Layer";

        private $http: angular.IHttpService;
        private $q: angular.IQService;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private hashService: HashService;
        private fileService: FileService;
        private routeLayerFactory: Layers.RouteLayers.RouteLayerFactory;
        private resourcesService: ResourcesService;
        private toastr: Toastr;
        private overlayZIndex;

        public baseLayers: IBaseLayer[];
        public overlays: IOverlay[];
        public routes: Layers.RouteLayers.RouteLayer[];
        public routeChangedEvent: Common.EventHelper<{}>;
        public selectedBaseLayer: IBaseLayer;
        public selectedRoute: Layers.RouteLayers.RouteLayer;
        public initializationPromise: angular.IPromise<any>;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            $rootScope: angular.IRootScopeService,
            $sce: angular.ISCEService,
            mapService: MapService,
            localStorageService: angular.local.storage.ILocalStorageService,
            routeLayerFactory: Layers.RouteLayers.RouteLayerFactory,
            hashService: HashService,
            fileService: FileService,
            resourcesService: ResourcesService,
            toastr: Toastr) {
            super(mapService);
            this.$http = $http;
            this.$q = $q;
            this.localStorageService = localStorageService;
            this.hashService = hashService;
            this.fileService = fileService;
            this.routeLayerFactory = routeLayerFactory;
            this.resourcesService = resourcesService;
            this.toastr = toastr;
            this.selectedBaseLayer = null;
            this.selectedRoute = null;
            this.baseLayers = [];
            this.overlays = [];
            this.routes = [];
            this.overlayZIndex = 10;
            this.routeChangedEvent = new Common.EventHelper<{}>();
            // default layers:
            this.addBaseLayer({
                key: LayersService.ISRAEL_HIKING_MAP,
                address: this.resourcesService.currentLanguage.tilesFolder + Common.Urls.DEFAULT_TILES_ADDRESS,
                isEditable: false
            } as ILayer, LayersService.ATTRIBUTION);

            this.addBaseLayer({
                key: LayersService.ISRAEL_MTB_MAP,
                address: this.resourcesService.currentLanguage.tilesFolder + Common.Urls.MTB_TILES_ADDRESS,
                isEditable: false
            } as ILayer, LayersService.MTB_ATTRIBUTION);
            try {
                var googleLayer = L.gridLayer.googleMutant({ type: "satellite" } as L.gridLayer.GoogleMutantOptions) as any;
                this.baseLayers.push({ key: LayersService.GOOGLE_EARTH, layer: googleLayer, selected: false, address: "", isEditable: false } as IBaseLayer);
            } catch (e) {
                console.error("Unable to create the google earch layer... ");
            }

            let hikingTrailsOverlay = this.addOverlay({
                key: LayersService.HIKING_TRAILS,
                address: Common.Urls.OVERLAY_TILES_ADDRESS,
                minZoom: LayersService.MIN_ZOOM,
                maxZoom: LayersService.MAX_NATIVE_ZOOM
            } as ILayer);
            hikingTrailsOverlay.isEditable = false;
            this.overlays.push({ visible: false, isEditable: false, address: "", key: "Wikipedia", layer: new WikiMarkersLayer($http, $rootScope, $sce, mapService, resourcesService) as L.Layer } as IOverlay);
            this.addLayersFromLocalStorage();
            this.addDataFromHash();
            this.changeLanguage();
            $rootScope.$watch(() => this.resourcesService.currentLanguage, () => { this.changeLanguage(); });
        }

        public addBaseLayer = (layerData: Common.LayerData, attribution?: string, position?: number): IBaseLayer => {
            var layer = _.find(this.baseLayers, (layerToFind) => layerToFind.key.toLocaleLowerCase() === layerData.key.toLocaleLowerCase());
            if (layer != null) {
                return layer; // layer exists
            }

            layer = angular.copy(layerData) as IBaseLayer;
            layer.layer = L.tileLayer(layerData.address, this.createOptionsFromLayerData(layerData, attribution));
            if (position != undefined) {
                this.baseLayers.splice(position, 0, layer);
            } else {
                this.baseLayers.push(layer);
            }
            var baseLayers = this.localStorageService.get<Common.LayerData[]>(LayersService.BASE_LAYERS_KEY) || [];
            baseLayers.push(layerData);
            this.localStorageService.set(LayersService.BASE_LAYERS_KEY, this.unique(baseLayers));
            return layer;
        }

        public addOverlay = (layerData: Common.LayerData): IOverlay => {
            var overlay = _.find(this.overlays, (overlayToFind) => overlayToFind.key.toLocaleLowerCase() === layerData.key.toLocaleLowerCase());
            if (overlay != null) {
                return overlay; // overlay exists
            }
            overlay = angular.copy(layerData) as IOverlay;
            overlay.layer = L.tileLayer(overlay.address, this.createOptionsFromLayerData(layerData));
            overlay.visible = false;
            overlay.isEditable = true;
            (overlay.layer as L.TileLayer).setZIndex(this.overlayZIndex++);
            this.overlays.push(overlay);
            var overlaysFromStorage = this.localStorageService.get<Common.LayerData[]>(LayersService.OVERLAYS_KEY) || [];
            overlaysFromStorage.push(layerData);
            this.localStorageService.set(LayersService.OVERLAYS_KEY, this.unique(overlaysFromStorage));
            return overlay;
        }

        public updateBaseLayer = (oldLayer: IBaseLayer, newLayer: Common.LayerData): string => {
            if (oldLayer.key !== newLayer.key &&
                _.find(this.baseLayers, bl => bl.key.toLocaleLowerCase() === newLayer.key.toLocaleLowerCase()) != null) {
                return `The name: '${newLayer.key}' is already in use.`;
            }
            let position = this.baseLayers.indexOf(_.find(this.baseLayers, bl => bl.key === oldLayer.key));
            this.removeBaseLayer(oldLayer);
            var layer = this.addBaseLayer(newLayer, null, position);
            this.selectBaseLayer(layer);
            return "";
        }

        public updateOverlay = (oldLayer: IOverlay, newLayer: Common.LayerData) => {
            if (oldLayer.key !== newLayer.key &&
                _.find(this.overlays, o => o.key.toLocaleLowerCase() === newLayer.key.toLocaleLowerCase()) != null) {
                return `The name: '${newLayer.key}' is already in use.`;
            }
            this.removeOverlay(oldLayer);
            var overlay = this.addOverlay(newLayer);
            this.toggleOverlay(overlay);
            return "";
        }

        public addRoute = (route: Layers.RouteLayers.IRoute) => {
            let routeLayer = this.routeLayerFactory.createRouteLayer(route);
            this.routes.push(routeLayer);
            this.map.addLayer(routeLayer);
            this.selectRoute(routeLayer);
        }

        public isNameAvailable = (name: string) => {
            var route = this.getRouteByName(name);
            return route == null && name != null && name !== "";
        }

        public removeBaseLayer = (baseLayer: IBaseLayer) => {
            var baseLayers = this.localStorageService.get<Common.LayerData[]>(LayersService.BASE_LAYERS_KEY);
            _.remove(baseLayers, (layerData) => layerData.key === baseLayer.key);
            this.localStorageService.set(LayersService.BASE_LAYERS_KEY, this.unique(baseLayers));
            if (this.selectedBaseLayer.key !== baseLayer.key) {
                _.remove(this.baseLayers, (layer) => baseLayer.key === layer.key);
                return;
            }
            var index = this.baseLayers.indexOf(this.selectedBaseLayer);
            index = (index + 1) % this.baseLayers.length;
            this.selectBaseLayer(this.baseLayers[index]);
            _.remove(this.baseLayers, (layer) => baseLayer.key === layer.key);
            if (this.baseLayers.length === 0) {
                this.map.removeLayer(baseLayer.layer);
                this.selectedBaseLayer = null;
            }
        }

        public removeOverlay = (overlay: IOverlay) => {
            var overlays = this.localStorageService.get(LayersService.OVERLAYS_KEY) as Common.LayerData[];
            _.remove(overlays, (layerData) => layerData.key === overlay.key);
            this.localStorageService.set(LayersService.OVERLAYS_KEY, this.unique(overlays));
            if (overlay.visible) {
                this.toggleOverlay(overlay);
            }
            _.remove(this.overlays, (overlayToRemove) => overlayToRemove.key === overlay.key);
        }

        public removeRoute = (routeName: string) => {
            let routeLayer = this.getRouteByName(routeName);
            if (routeLayer == null) {
                return;
            }
            if (this.selectedRoute === routeLayer) {
                this.selectRoute(null);
            }
            this.map.removeLayer(routeLayer);
            this.routes.splice(this.routes.indexOf(routeLayer), 1);
        }

        public selectBaseLayer = (baseLayer: IBaseLayer) => {
            if (baseLayer.selected) {
                return;
            }
            if (this.selectedBaseLayer) {
                this.map.removeLayer(this.selectedBaseLayer.layer);
                this.selectedBaseLayer.selected = false;
            }
            var newSelectedLayer = _.find(this.baseLayers, (layer) => layer.key === baseLayer.key);
            this.map.addLayer(newSelectedLayer.layer);
            newSelectedLayer.selected = true;
            this.selectedBaseLayer = newSelectedLayer;

            this.localStorageService.set(LayersService.ACTIVE_BASELAYER_KEY, this.selectedBaseLayer.key);
        }

        public toggleOverlay = (overlay: IOverlay) => {
            var overlayFromArray = _.find(this.overlays, (overlayToFind) => overlayToFind.key === overlay.key);
            overlayFromArray.visible = !overlayFromArray.visible;
            if (overlayFromArray.visible) {
                this.map.addLayer(overlay.layer);
                let activeOverlays = (this.localStorageService.get(LayersService.ACTIVE_OVERLAYS_KEY) || []) as string[];
                if (activeOverlays.indexOf(overlay.key) === -1) {
                    activeOverlays.push(overlay.key);
                    this.localStorageService.set(LayersService.ACTIVE_OVERLAYS_KEY, activeOverlays);
                }
            } else {
                this.map.removeLayer(overlay.layer);
                let activeOverlays = (this.localStorageService.get(LayersService.ACTIVE_OVERLAYS_KEY) || []) as string[];
                if (activeOverlays.indexOf(overlay.key) > -1) {
                    activeOverlays.splice(activeOverlays.indexOf(overlay.key), 1);
                    this.localStorageService.set(LayersService.ACTIVE_OVERLAYS_KEY, activeOverlays);
                }
            }
        }

        public changeRouteState = (routeLayer: RouteLayers.RouteLayer) => {
            if (routeLayer === this.selectedRoute && routeLayer.getRouteProperties().isVisible) {
                this.selectRoute(null);
                this.map.removeLayer(routeLayer);
                return;
            }
            if (routeLayer.getRouteProperties().isVisible === false) {
                this.map.addLayer(routeLayer);
            }
            this.selectRoute(routeLayer);
        }

        private selectRoute = (routeLayer: RouteLayers.RouteLayer) => {
            if (this.selectedRoute) {
                this.selectedRoute.readOnly();
            }
            this.selectedRoute = routeLayer;
            this.routeChangedEvent.raiseEvent({});
        }

        public createRouteName = () => {
            var index = 1;
            var routeName = `${this.resourcesService.route} ${index}`;
            while (_.some(this.routes, (routeLayer) => routeLayer.getRouteProperties().name === routeName)) {
                index++;
                routeName = `${this.resourcesService.route} ${index}`;
            }
            return routeName;
        }

        private addLayersFromLocalStorage = () => {
            var baseLayers = this.localStorageService.get<Common.LayerData[]>(LayersService.BASE_LAYERS_KEY) || [];
            for (let baseLayerIndex = 0; baseLayerIndex < baseLayers.length; baseLayerIndex++) {
                let baseLayer = baseLayers[baseLayerIndex] as ILayer;
                baseLayer.isEditable = true;
                this.addBaseLayer(baseLayer);
            }

            var overlays = this.localStorageService.get<Common.LayerData[]>(LayersService.OVERLAYS_KEY) || [];
            for (let overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
                let overlayData = overlays[overlayIndex] as ILayer;
                overlayData.isEditable = true;
                this.addOverlay(overlayData);
            }
        }

        private addDataFromHash = () => {
            let deferred = this.$q.defer();
            this.initializationPromise = deferred.promise;
            if (this.hashService.siteUrl) {
                this.$http.get(Common.Urls.urls + this.hashService.siteUrl)
                    .then((response: { data: Common.SiteUrl }) => {
                        let data = JSON.parse(response.data.jsonData) as Common.DataContainer;
                        this.setJsonData(data);
                        this.addOverlaysFromHash(data.overlays);
                        this.hashService.clear();
                        this.toastr.info(response.data.description, response.data.title);
                        deferred.resolve();
                    }, () => {
                        let data = this.hashService.getDataContainer();
                        this.setData(data, true);
                        this.addBaseLayerFromHash(data.baseLayer);
                        this.hashService.siteUrl = "";
                        this.hashService.clear();
                        this.toastr.warning(this.resourcesService.unableToLoadFromUrl);
                        deferred.resolve();
                    });
                return;
            }
            if (this.hashService.externalUrl) {
                this.fileService.openFromUrl(this.hashService.externalUrl)
                    .then((response: { data: Common.DataContainer }) => {
                        response.data.baseLayer = this.hashService.getDataContainer().baseLayer;
                        this.setJsonData(response.data);
                        deferred.resolve();
                    });
            } else {
                let data = this.hashService.getDataContainer();
                this.setData(data, true);
                this.addBaseLayerFromHash(data.baseLayer);
                deferred.resolve();
            }
            this.hashService.clear();
            for (let overlayKey of (this.localStorageService.get(LayersService.ACTIVE_OVERLAYS_KEY) || []) as string[]) {
                let overlay = _.find(this.overlays, overlayToFind => overlayToFind.key === overlayKey);
                if (overlay && overlay.visible === false) {
                    this.toggleOverlay(overlay);
                }
            }
        }

        public setJsonData = (data: Common.DataContainer) => {
            if (data.routes) {
                for (let route of data.routes) {
                    for (let segment of route.segments) {
                        let latlngzs = [] as Common.LatLngZ[];
                        for (let latlngz of segment.latlngzs) {
                            var fullLatLngZ = L.latLng(latlngz.lat, latlngz.lng) as Common.LatLngZ;
                            fullLatLngZ.z = latlngz.z;
                            latlngzs.push(fullLatLngZ);
                        }
                        segment.latlngzs = latlngzs;
                        segment.routePoint = L.latLng(segment.routePoint.lat, segment.routePoint.lng);
                    }
                    if (route.markers) {
                        for (let marker of route.markers) {
                            marker.latlng = L.latLng(marker.latlng.lat, marker.latlng.lng);
                        }
                    }
                }
            }
            this.setData(data, false);
            this.addBaseLayerFromHash(data.baseLayer);
        }

        public getSelectedRoute = (): RouteLayers.RouteLayer => {
            return this.selectedRoute;
        }

        public getRouteByName = (routeName: string): Layers.RouteLayers.RouteLayer => {
            return _.find(this.routes, (routeLayerToFind) => routeLayerToFind.getRouteProperties().name === routeName);
        }

        private addBaseLayerFromHash = (layerData: Common.LayerData) => {
            if (layerData == null || (layerData.address === "" && layerData.key === "")) {
                let baseLayerToActivate = _.find(this.baseLayers, baseToFind => baseToFind.key === this.localStorageService.get(LayersService.ACTIVE_BASELAYER_KEY));
                if (baseLayerToActivate) {
                    this.selectBaseLayer(baseLayerToActivate);
                } else {
                    this.selectBaseLayer(this.baseLayers[0]);
                }
                return;
            }
            var baseLayer = _.find(this.baseLayers, (baseLayerToFind) =>
                baseLayerToFind.address.toLocaleLowerCase() === layerData.address.toLocaleLowerCase() ||
                baseLayerToFind.key.toLocaleLowerCase() === layerData.key.toLocaleLowerCase());
            if (baseLayer != null) {
                this.selectBaseLayer(baseLayer);
                return;
            }
            var key = layerData.key;
            if (key === "") {
                key = LayersService.CUSTOM_LAYER + " ";
                let index = 0;
                let layer: IBaseLayer;
                let customName: string;
                do {
                    index++;
                    customName = key + index.toString();
                    layer = _.find(this.baseLayers, (baseLayerToFind) => baseLayerToFind.key === customName);
                } while (layer != null);
                key = customName;
                layerData.minZoom = LayersService.MIN_ZOOM;
                layerData.maxZoom = LayersService.MAX_NATIVE_ZOOM;
            }

            var newLayer = this.addBaseLayer({
                key: key,
                address: layerData.address,
                minZoom: layerData.minZoom,
                maxZoom: layerData.maxZoom,
                isEditable: true
            } as ILayer);
            this.selectBaseLayer(newLayer);
        }

        private addOverlaysFromHash = (overlays: Common.LayerData[]) => {
            for (let overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
                let overlay = this.addOverlay(overlays[overlayIndex]);
                if (overlay.visible === false) {
                    this.toggleOverlay(overlay);
                }
            }
        }

        private unique(layers: Common.LayerData[]): Common.LayerData[] {
            var layersMap = {};
            return layers.reverse().filter((layer) => {
                if (layersMap[layer.key.toLowerCase()]) {
                    return false;
                }
                layersMap[layer.key.toLowerCase()] = true;
                return true;
            });
        }

        private createOptionsFromLayerData = (layerData: Common.LayerData, attribution?: string): L.TileLayerOptions => {
            return {
                minZoom: layerData.minZoom || LayersService.MIN_ZOOM,
                maxNativeZoom: layerData.maxZoom || LayersService.MAX_NATIVE_ZOOM,
                maxZoom: LayersService.MAX_ZOOM,
                attribution: attribution || LayersService.ATTRIBUTION
            } as L.TileLayerOptions;
        }

        public getData = () => {
            var container = {
                routes: [],
                baseLayer: null,
                overlays: [],
                northEast: this.map.getBounds().getNorthEast(),
                southWest: this.map.getBounds().getSouthWest()
            } as Common.DataContainer;

            for (let route of this.routes) {
                if (route.getRouteProperties().isVisible) {
                    container.routes.push(route.getData());
                }
            }
            container.baseLayer = this.extractDataFromLayer(this.selectedBaseLayer);
            var visibaleOverlays = this.overlays.filter(overlay => overlay.visible);
            for (let overlayIndex = 0; overlayIndex < visibaleOverlays.length; overlayIndex++) {
                container.overlays.push(this.extractDataFromLayer(visibaleOverlays[overlayIndex]));
            }
            return container;
        }

        private setData = (dataContainer: Common.DataContainer, reroute: boolean) => {
            if (dataContainer.routes.length === 0) {
                dataContainer.routes.push({
                    name: this.createRouteName(),
                    markers: [],
                    segments: []
                } as Common.RouteData);
            }
            for (let routeData of dataContainer.routes) {
                if (this.isNameAvailable(routeData.name) === false) {
                    routeData.name = this.createRouteName();
                }
                let routeLayer = this.routeLayerFactory.createRouteLayerFromData(routeData, reroute);
                this.routes.push(routeLayer);
                this.map.addLayer(routeLayer);
                this.selectRoute(routeLayer);
            }

            if (dataContainer.northEast != null && dataContainer.southWest != null) {
                this.map.fitBounds(L.latLngBounds(dataContainer.southWest, dataContainer.northEast));
            }
        }

        private extractDataFromLayer = (layer: ILayer): Common.LayerData => {
            return {
                key: layer.key,
                address: layer.address,
                minZoom: layer.minZoom,
                maxZoom: layer.maxZoom
            } as Common.LayerData;
        }

        private changeLanguage() {
            let ihmLayer = _.find(this.baseLayers, bl => bl.key === LayersService.ISRAEL_HIKING_MAP);
            this.replaceBaseLayerAddress(ihmLayer,
                this.resourcesService.currentLanguage.tilesFolder + Common.Urls.DEFAULT_TILES_ADDRESS,
                LayersService.ATTRIBUTION, 0);
            let mtbLayer = _.find(this.baseLayers, bl => bl.key === LayersService.ISRAEL_MTB_MAP);
            this.replaceBaseLayerAddress(mtbLayer,
                this.resourcesService.currentLanguage.tilesFolder + Common.Urls.MTB_TILES_ADDRESS,
                LayersService.MTB_ATTRIBUTION, 1);
        }

        private replaceBaseLayerAddress(layer: IBaseLayer, newAddress: string, attribution: string, position: number) {
            _.remove(this.baseLayers, (layerToRemove) => layer.key === layerToRemove.key);
            if (this.selectedBaseLayer != null && this.selectedBaseLayer.key === layer.key) {
                this.map.removeLayer(layer.layer);
            }
            layer.layer = null;
            layer.address = newAddress;
            layer.selected = false;
            let newLayer = this.addBaseLayer(layer, attribution, position);
            if (this.selectedBaseLayer != null && this.selectedBaseLayer.key === layer.key) {
                this.selectedBaseLayer = null;
                this.selectBaseLayer(newLayer);
            }
        }
    }
}
