declare module L {
    export class Google { new() }
}

declare var getLastModifiedDate: Function;

module IsraelHiking.Services {
    export interface ILayer extends Common.LayerData {
        layer: L.TileLayer;
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
        public static DEFAULT_TILES_ADDRESS = "http://IsraelHiking.osm.org.il/Tiles/{z}/{x}/{y}.png";
        public static MIN_ZOOM = 7;
        public static MAX_NATIVE_ZOOM = 16;

        private static MAX_ZOOM = 20;
        private static ISRAEL_HIKING_MAP = "Israel Hiking Map";
        private static GOOGLE_EARTH = "Google Earth";
        private static HIKING_TRAILS = "Hiking Trails";
        private static ATTRIBUTION = "Map data &copy; <a href='http://openstreetmap.org' target='_blank'>OpenStreetMap</a> contributors, <a href='http://creativecommons.org/licenses/by-sa/2.0/' target='_blank\">CC-BY-SA</a>, built with <a href='http://getbootstrap.com/' target='_blank'>Bootstrap</a>. ";
        private static MTB_ATTRIBUTION = LayersService.ATTRIBUTION + "Map style courtesy of <a href='http://mtbmap.no'>MTBmap.no.</a> ";
        private static BASE_LAYERS_KEY = "BaseLayers";
        private static OVERLAYS_KEY = "Overlays";
        private static CUSTOM_LAYER = "Custom Layer";
        private static MTB_TILES_ADDRESS = "http://IsraelHiking.osm.org.il/mtbTiles/{z}/{x}/{y}.png";
        private static OVERLAY_TILES_ADDRESS = "http://IsraelHiking.osm.org.il/OverlayTiles/{z}/{x}/{y}.png";

        private $http: angular.IHttpService;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private hashService: HashService;
        private drawingFactory: Drawing.DrawingFactory;
        private defaultAttribution: string;
        private overlayZIndex;

        public baseLayers: IBaseLayer[];
        public overlays: IOverlay[];
        public markers: Drawing.DrawingMarker;
        public routes: Drawing.DrawingRoute[];
        public eventHelper: Common.EventHelper<Common.IDataChangedEventArgs>
        public selectedBaseLayer: IBaseLayer;
        public selectedDrawing: Drawing.IDrawing;

        constructor($http: angular.IHttpService,
            mapService: MapService,
            localStorageService: angular.local.storage.ILocalStorageService,
            drawingFactory: Drawing.DrawingFactory,
            hashService: HashService) {
            super(mapService);
            this.$http = $http;
            this.localStorageService = localStorageService
            this.hashService = hashService;
            this.drawingFactory = drawingFactory;
            this.selectedBaseLayer = null;
            this.baseLayers = [];
            this.overlays = [];
            this.routes = [];
            this.overlayZIndex = 10;
            this.eventHelper = new Common.EventHelper<Common.IDataChangedEventArgs>();
            this.markers = this.drawingFactory.createDrawingMarker([]);

            var lastModified = (typeof getLastModifiedDate == "function") ? getLastModifiedDate() : (new Date(document.lastModified)).toDateString();
            this.defaultAttribution = LayersService.ATTRIBUTION + "Last update: " + lastModified;
            // default layers:
            this.addBaseLayer(<ILayer> {
                key: LayersService.ISRAEL_HIKING_MAP,
                address: LayersService.DEFAULT_TILES_ADDRESS,
                isEditable: false,
            }, this.defaultAttribution);

            this.addBaseLayer(<ILayer> {
                key: LayersService.ISRAEL_MTB_MAP,
                address: LayersService.MTB_TILES_ADDRESS,
                isEditable: false,
            }, LayersService.MTB_ATTRIBUTION + lastModified);

            this.baseLayers.push(<IBaseLayer> { key: LayersService.GOOGLE_EARTH, layer: <any>new L.Google(), selected: false, address: "", isEditable: false });
            var overlay = this.addOverlay(<Common.LayerData> {
                key: LayersService.HIKING_TRAILS,
                address: LayersService.OVERLAY_TILES_ADDRESS,
                minZoom: LayersService.MIN_ZOOM,
                maxZoom: LayersService.MAX_NATIVE_ZOOM,
                isEditable: false
            });
            this.toggleOverlay(overlay);
            this.addLayersFromLocalStorage();
            this.addDataFromHash();
        }

        public addBaseLayer = (layerData: Common.LayerData, attribution?: string): IBaseLayer => {
            var layer = _.find(this.baseLayers, (layerToFind) => layerToFind.key.toLocaleLowerCase() == layerData.key.toLocaleLowerCase());
            if (layer != null) {
                return layer; // layer exists
            }

            layer = <IBaseLayer>angular.copy(layerData);
            layer.layer = L.tileLayer(layerData.address, this.createOptionsFromLayerData(layerData, attribution));
            this.baseLayers.push(layer);
            var baseLayers = this.localStorageService.get<Common.LayerData[]>(LayersService.BASE_LAYERS_KEY) || [];
            baseLayers.push(layerData);
            this.localStorageService.set(LayersService.BASE_LAYERS_KEY, this.unique(baseLayers));
            return layer;
        }

        public addOverlay = (layerData: Common.LayerData): IOverlay => {
            var overlay = _.find(this.overlays, (overlayToFind) => overlayToFind.key.toLocaleLowerCase() == layerData.key.toLocaleLowerCase());
            if (overlay != null) {
                return overlay; // overlay exists
            }
            overlay = <IOverlay>angular.copy(layerData);
            overlay.layer = L.tileLayer(overlay.address, this.createOptionsFromLayerData(layerData));
            overlay.visible = false;
            overlay.layer.setZIndex(this.overlayZIndex++);
            this.overlays.push(overlay);
            var overlaysFromStorage = this.localStorageService.get<Common.LayerData[]>(LayersService.OVERLAYS_KEY) || [];
            overlaysFromStorage.push(layerData);
            this.localStorageService.set(LayersService.OVERLAYS_KEY, this.unique(overlaysFromStorage));
            return overlay;
        }

        public updateBaseLayer = (oldLayer: IBaseLayer, newLayer: Common.LayerData): string => {
            if (oldLayer.key != newLayer.key &&
                _.find(this.baseLayers, bl => bl.key.toLocaleLowerCase() == newLayer.key.toLocaleLowerCase()) != null) {
                return "The name: '" + newLayer.key + "' is already in use.";
            }
            this.removeBaseLayer(oldLayer);
            var layer = this.addBaseLayer(newLayer);
            this.selectBaseLayer(layer);
            return "";
        }

        public updateOverlay = (oldLayer: IOverlay, newLayer: Common.LayerData) => {
            if (oldLayer.key != newLayer.key &&
                _.find(this.overlays, o => o.key.toLocaleLowerCase() == newLayer.key.toLocaleLowerCase()) != null) {
                return "The name: '" + newLayer.key + "' is already in use.";
            }
            this.removeOverlay(oldLayer);
            var overlay = this.addOverlay(newLayer);
            this.toggleOverlay(overlay);
            return "";
        }

        public addRoute = (name: string, routeData: Common.RouteData, pathOptions?: L.PathOptions) => {
            if (name == "") {
                name = this.createRouteName();
            }
            var route = this.getRouteByName(name);
            if (route != null && routeData != null) {
                route.setData(routeData);
                return;
            }
            routeData = routeData || <Common.RouteData> {
                segments: [],
            };
            routeData.name = name; // in case name is empty we'll override it.
            var drawingRoute = this.drawingFactory.createDrawingRoute(routeData, false, pathOptions);
            this.routes.push(drawingRoute);
            this.changeDrawingState(drawingRoute.name);
        }

        public isNameAvailable = (name: string) => {
            var route = this.getRouteByName(name);
            return route == null;
        }

        public removeBaseLayer = (baseLayer: Services.IBaseLayer) => {
            var baseLayers = this.localStorageService.get<Common.LayerData[]>(LayersService.BASE_LAYERS_KEY);
            _.remove(baseLayers, (layerData) => layerData.key == baseLayer.key);
            this.localStorageService.set(LayersService.BASE_LAYERS_KEY, this.unique(baseLayers));
            if (this.selectedBaseLayer.key != baseLayer.key) {
                _.remove(this.baseLayers, (layer) => baseLayer.key == layer.key);
                return;
            }
            var index = this.baseLayers.indexOf(this.selectedBaseLayer);
            index = (index + 1) % this.baseLayers.length;
            this.selectBaseLayer(this.baseLayers[index]);
            _.remove(this.baseLayers, (layer) => baseLayer.key == layer.key);
            if (this.baseLayers.length == 0) {
                this.map.removeLayer(baseLayer.layer);
                this.selectedBaseLayer = null;
            }
        }

        public removeOverlay = (overlay: IOverlay) => {
            var overlays = this.localStorageService.get<Common.LayerData[]>(LayersService.OVERLAYS_KEY);
            _.remove(overlays, (layerData) => layerData.key == overlay.key);
            this.localStorageService.set(LayersService.OVERLAYS_KEY, this.unique(overlays));
            if (overlay.visible) {
                this.map.removeLayer(overlay.layer);
            }
            _.remove(this.overlays, (overlayToRemove) => overlayToRemove.key == overlay.key);
        }

        public removeRoute = (routeName: string) => {
            var route = this.getRouteByName(routeName);
            if (route == null) {
                return;
            }
            route.destroy();
            this.routes.splice(this.routes.indexOf(route), 1);
            //this.hashService.removeRoute(routeName);
        }

        public selectBaseLayer = (baseLayer: Services.IBaseLayer) => {
            if (baseLayer.selected) {
                return;
            }
            if (this.selectedBaseLayer) {
                this.map.removeLayer(this.selectedBaseLayer.layer);
                this.selectedBaseLayer.selected = false;
            }
            var newSelectedLayer = _.find(this.baseLayers, (layer) => layer.key == baseLayer.key);
            this.map.addLayer(newSelectedLayer.layer, true);
            newSelectedLayer.selected = true;
            this.selectedBaseLayer = newSelectedLayer;
            this.updateBaseLayerHash();
        }

        public toggleOverlay = (overlay: IOverlay) => {
            var overlayFromArray = _.find(this.overlays, (overlayToFind) => overlayToFind.key == overlay.key);
            overlayFromArray.visible = !overlayFromArray.visible;
            if (overlayFromArray.visible) {
                this.map.addLayer(overlay.layer);
            } else {
                this.map.removeLayer(overlay.layer);
            }
        }

        public changeDrawingState = (name: string) => {
            var drawing = <Drawing.IDrawing>this.getRouteByName(name);
            if (name == this.markers.name) {
                drawing = this.markers;
            }
            if (drawing == null) {
                return;
            }
            if (drawing == this.selectedDrawing) {
                if (drawing.state == Services.Drawing.DrawingState.active) {
                    this.selectedDrawing.changeStateTo(Drawing.DrawingState.hidden);
                    return;
                }
                if (drawing.state == Services.Drawing.DrawingState.hidden) {
                    this.selectedDrawing.changeStateTo(Drawing.DrawingState.active);
                    return;
                }
            }

            if (this.selectedDrawing && this.selectedDrawing.state == Services.Drawing.DrawingState.active) {
                this.selectedDrawing.changeStateTo(Drawing.DrawingState.inactive);
            }
            this.selectedDrawing = drawing;
            this.selectedDrawing.changeStateTo(Drawing.DrawingState.active);
            this.eventHelper.raiseEvent(<Common.IDataChangedEventArgs>{});
        }

        public createRouteName = () => {
            var index = 1;
            var routeName = "Route " + index;
            while (_.any(this.routes, (route) => route.name == routeName)) {
                index++;
                routeName = "Route " + index;
            }
            return routeName;
        }

        private addLayersFromLocalStorage = () => {
            var baseLayers = this.localStorageService.get<Common.LayerData[]>(LayersService.BASE_LAYERS_KEY) || [];
            for (var baseLayerIndex = 0; baseLayerIndex < baseLayers.length; baseLayerIndex++) {
                var baseLayer = <ILayer>baseLayers[baseLayerIndex];
                baseLayer.isEditable = true;
                this.addBaseLayer(baseLayer);
            }

            var overlays = this.localStorageService.get<Common.LayerData[]>(LayersService.OVERLAYS_KEY) || [];
            for (var overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
                var overlayData = <ILayer>overlays[overlayIndex];
                overlayData.isEditable = true;
                var overlay = this.addOverlay(overlayData);
                this.toggleOverlay(overlay);
            }
        }

        private addDataFromHash = () => {
            if (this.hashService.siteUrl) {
                this.$http.get(Common.Urls.urls + this.hashService.siteUrl).success((siteUrl: Common.SiteUrl) => {
                    var data = JSON.parse(siteUrl.JsonData);
                    this.setData(data);
                    this.addBaseLayerFromHash(data.baseLayer);
                    this.addOverlaysFromHash(data.overlays);
                    this.hashService.clear();
                });
                return;
            } else {
                var data = this.hashService.getDataContainer();
                this.setData(data);
                this.addBaseLayerFromHash(data.baseLayer);
                this.hashService.clear();
            }
        }

        public getSelectedDrawing = (): Drawing.IDrawing => {
            return this.selectedDrawing;
        }

        public addMarkers = (markers: Common.MarkerData[]) => {
            this.markers.addMarkers(markers);
        }

        public getRouteByName = (routeName: string): Drawing.DrawingRoute => {
            return _.find(this.routes, (drawingToFind) => drawingToFind.name == routeName);
        }

        public createPathOptions = () => {
            return this.drawingFactory.createPathOptions();
        }

        private addBaseLayerFromHash = (layerData: Common.LayerData) => {
            if (layerData == null || (layerData.address == "" && layerData.key =="")) {
                this.selectBaseLayer(this.baseLayers[0]);
                return;
            }
            var baseLayer = _.find(this.baseLayers, (baseLayerToFind) =>
                baseLayerToFind.address.toLocaleLowerCase() == layerData.address.toLocaleLowerCase() ||
                baseLayerToFind.key.toLocaleLowerCase() == layerData.key.toLocaleLowerCase());
            if (baseLayer != null) {
                this.selectBaseLayer(baseLayer);
                return;
            }
            var key = layerData.key;
            if (key == "") {
                key = LayersService.CUSTOM_LAYER + " ";
                var index = 0;
                var layer = null;
                var customName = key + index.toString();
                do {
                    index++;
                    customName = key + index.toString();
                    layer = _.find(this.baseLayers, (baseLayerToFind) => baseLayerToFind.key == customName);
                } while (layer != null);
            }
            
            layer = this.addBaseLayer(<ILayer> {
                key: key,
                address: layerData.address,
                minZoom: layerData.minZoom,
                maxZoom: layerData.maxZoom,
                isEditable: true,
            });
            this.selectBaseLayer(layer);
        }

        private addOverlaysFromHash = (overlays: Common.LayerData[]) => {
            for (var overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
                var overlay = this.addOverlay(overlays[overlayIndex]);
                if (overlay.visible == false) {
                    this.toggleOverlay(overlay);
                }
            }
        }

        private updateBaseLayerHash = () => {
            var baseLayer = "";
            if (this.selectedBaseLayer == null) {
                baseLayer = "";
            }
            else if (this.selectedBaseLayer.key == LayersService.ISRAEL_HIKING_MAP ||
                this.selectedBaseLayer.key == LayersService.ISRAEL_MTB_MAP ||
                this.selectedBaseLayer.key == LayersService.GOOGLE_EARTH) {
                baseLayer = this.selectedBaseLayer.key;
            }
            else {
                baseLayer = this.selectedBaseLayer.address;
            }
            //this.hashService.updateBaseLayer(baseLayer);
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
            return <L.TileLayerOptions>{
                minZoom: layerData.minZoom || LayersService.MIN_ZOOM,
                maxNativeZoom: layerData.maxZoom || LayersService.MAX_NATIVE_ZOOM,
                maxZoom: LayersService.MAX_ZOOM,
                attribution: attribution || this.defaultAttribution
            };
        }

        public getData = () => {
            var container = <Common.DataContainer>{
                markers: [],
                routes: [],
                baseLayer: null,
                overlays: [],
            };

            container.markers = this.markers.getData();
            for (var routeIndex = 0; routeIndex < this.routes.length; routeIndex++) {
                container.routes.push(this.routes[routeIndex].getData());
            }
            container.baseLayer = this.extractDataFromLayer(this.selectedBaseLayer);
            var visibaleOverlays = this.overlays.filter(overlay => overlay.visible);
            for (var overlayIndex = 0; overlayIndex < visibaleOverlays.length; overlayIndex++) {
                container.overlays.push(this.extractDataFromLayer(visibaleOverlays[overlayIndex]));
            }
            return container;
        }

        private setData = (dataContainer: Common.DataContainer) => {
            if (dataContainer.routes.length == 0) {
                dataContainer.routes.push(<Common.RouteData>{
                    name: this.createRouteName(),
                    segments: []
                });
            }
            for (var routeIndex = 0; routeIndex < dataContainer.routes.length; routeIndex++) {
                this.routes.push(this.drawingFactory.createDrawingRoute(dataContainer.routes[routeIndex], true));
            }
            this.addMarkers(dataContainer.markers);
            this.changeDrawingState((this.routes.length > 0) ? this.routes[0].name : this.markers.name);
        }

        private extractDataFromLayer = (layer: ILayer): Common.LayerData => {
            return <Common.LayerData>{
                key: layer.key,
                address: layer.address,
                minZoom: layer.minZoom,
                maxZoom: layer.maxZoom,
            };
        }
    }
}
