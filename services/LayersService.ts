declare module L {
    export class Google { new() }
}

module IsraelHiking.Services {
    export interface ILayer {
        key: string;
        layer: L.TileLayer;
    }

    export interface ILayerData {
        key: string;
        address: string;
    }

    export interface IBaseLayer extends ILayer {
        selected: boolean
    }

    export interface IOvelay extends ILayer {
        visible: boolean;
    }

    export class LayersService extends ObjectWithMap {
        private static ISRAEL_HIKING_MAP = "Israel Hiking map";
        private static ISRAEL_MTB_MAP = "Israel MTB map";
        private static GOOGLE_EARTH = "Google Earth";
        private static HIKING_TRAILS = "Hiking trails";
        private static ATTRIBUTION = "Map data &copy; <a href='http://openstreetmap.org' target='_blank'>OpenStreetMap</a> contributors, <a href='http://creativecommons.org/licenses/by-sa/2.0/' target='_blank\">CC-BY-SA</a>, built with <a href='http://getbootstrap.com/' target='_blank'>Bootstrap</a>. Last update: ";
        private static BASE_LAYERS_KEY = "BaseLayers";
        private static OVERLAYS_KEY = "Overlays";

        private $injector: angular.auto.IInjectorService;
        private localStorageService: angular.local.storage.ILocalStorageService;
        private tileLayerOptions: L.TileLayerOptions;
        private overlayZIndex;
        private dataChangedEventHandler: (date: IDataChangedEventArgs) => void;

        public baseLayers: IBaseLayer[];
        public overlays: IOvelay[];
        public routes: DrawingRouteService[];
        public eventHelper: Common.EventHelper<IDataChangedEventArgs>
        public selectedBaseLayer: IBaseLayer;
        public selectedRoute: DrawingRouteService;

        constructor($injector: angular.auto.IInjectorService) {
            super($injector.get(Common.Constants.mapService));
            this.$injector = $injector;
            this.localStorageService = this.$injector.get(Common.Constants.localStorageService);
            this.selectedBaseLayer = null;
            this.selectedRoute = null;
            this.baseLayers = [];
            this.overlays = [];
            this.routes = [];
            this.overlayZIndex = 10;
            this.eventHelper = new Common.EventHelper<IDataChangedEventArgs>();
            var lastModified = "17/07/2015";//(typeof getLastModifiedDate == "function") ? getLastModifiedDate() : document.lastModified;
            this.tileLayerOptions = <L.TileLayerOptions> {
                minZoom: 7,
                maxZoom: 16,
                attribution: LayersService.ATTRIBUTION + lastModified
            };
            this.dataChangedEventHandler = (args: IDataChangedEventArgs) => {
                this.eventHelper.raiseEvent(args);
            }
            // default layers:
            this.addBaseLayer(LayersService.ISRAEL_HIKING_MAP, "http://www.osm.org.il/IsraelHiking/Tiles/{z}/{x}/{y}.png");
            //this.addBaseLayer(LayersService.ISRAEL_HIKING_MAP, "Tiles/{z}/{x}/{y}.png");
            this.addBaseLayer(LayersService.ISRAEL_MTB_MAP, "http://www.osm.org.il/IsraelHiking/mtbTiles/{z}/{x}/{y}.png");
            //this.addBaseLayer(LayersService.ISRAEL_MTB_MAP, "mtbTiles/{z}/{x}/{y}.png");
            this.baseLayers.push(<IBaseLayer> { key: LayersService.GOOGLE_EARTH, layer: <any>new L.Google(), selected: false });
            this.addOverlay(LayersService.HIKING_TRAILS, "http://www.osm.org.il/IsraelHiking/OverlayTiles/{z}/{x}/{y}.png");

            this.addLayersFromLocalStorage();

            this.selectBaseLayer(this.baseLayers[0]);
            this.toggleOverlay(this.overlays[0]);
        }

        public addBaseLayer = (key: string, address: string) => {
            if (_.find(this.baseLayers,(layerToFind) => layerToFind.key == key)) {
                return; // layer exists
            }
            var layer = <IBaseLayer>{ key: key, layer: L.tileLayer(address, this.tileLayerOptions), selected: false };
            this.baseLayers.push(layer);
            this.selectBaseLayer(layer);
            var baseLayers = this.localStorageService.get<ILayerData[]>(LayersService.BASE_LAYERS_KEY) || [];
            baseLayers.push(<ILayerData>{ key: key, address: address });
            this.localStorageService.set(LayersService.BASE_LAYERS_KEY, baseLayers);
        }

        public addOverlay = (key: string, address: string) => {
            if (_.find(this.overlays,(overlayToFind) => overlayToFind.key == key)) {
                return; // overlay exists
            }
            var overlay = <IOvelay>{ key: key, layer: L.tileLayer(address, this.tileLayerOptions), visible: false };
            overlay.layer.setZIndex(this.overlayZIndex++);
            this.overlays.push(overlay);
            this.toggleOverlay(overlay);
            var overlays = this.localStorageService.get<ILayerData[]>(LayersService.OVERLAYS_KEY) || [];
            overlays.push(<ILayerData>{ key: key, address: address });
            this.localStorageService.set(LayersService.OVERLAYS_KEY, overlays);
        }

        public addRoute = (name: string, routeData?: Common.RouteData, reRoute?: boolean) => {
            if (name == "") {
                name = this.createRouteName();
            }
            if (_.find(this.routes,(routeToFind) => routeToFind.name == name)) {
                return; // route exists
            }
            var drawingRouteService = new Services.DrawingRouteService(
                <angular.IQService>this.$injector.get(Common.Constants.q),
                <MapService>this.$injector.get(Common.Constants.mapService),
                <Routers.RouterFactory>this.$injector.get(Common.Constants.routerFactory),
                name);
            drawingRouteService.setData(routeData || <Common.RouteData> {
                routingType: Common.routingType.none,
                segments: [],
                name: name,
            });
            if (reRoute) {
                drawingRouteService.changeRoutingType(drawingRouteService.getRoutingType());
            }
            this.routes.push(drawingRouteService);
            this.selectRoute(drawingRouteService.name);
            this.eventHelper.raiseEvent(<IDataChangedEventArgs>{});
        }

        public removeBaseLayer = (baseLayer: Services.IBaseLayer) => {
            var baseLayers = this.localStorageService.get<ILayerData[]>(LayersService.BASE_LAYERS_KEY);
            _.remove(baseLayers,(layerData) => layerData.key == baseLayer.key);
            this.localStorageService.set(LayersService.BASE_LAYERS_KEY, baseLayers);
            if (this.selectedBaseLayer.key != baseLayer.key) {
                _.remove(this.baseLayers,(layer) => baseLayer.key == layer.key);
                return;
            }
            var index = this.baseLayers.indexOf(this.selectedBaseLayer);
            index = (index + 1) % this.baseLayers.length;
            this.selectBaseLayer(this.baseLayers[index]);
            _.remove(this.baseLayers,(layer) => baseLayer.key == layer.key);
            if (this.baseLayers.length == 0) {
                this.map.removeLayer(baseLayer.layer);
                this.selectedBaseLayer = null;
            }
        }

        public removeOverlay = (overlay: IOvelay) => {
            var overlays = this.localStorageService.get<ILayerData[]>(LayersService.OVERLAYS_KEY);
            _.remove(overlays,(layerData) => layerData.key == overlay.key);
            this.localStorageService.set(LayersService.OVERLAYS_KEY, overlays);
            if (overlay.visible) {
                this.map.removeLayer(overlay.layer);
            }
            _.remove(this.overlays,(overlayToRemove) => overlayToRemove.key == overlay.key);
        }

        public removeRoute = (routeName: string) => {
            var drawingRouteService = _.find(this.routes,(routeToFind) => routeToFind.name == routeName);
            if (drawingRouteService == null) {
                return;
            }
            drawingRouteService.destroy();
            this.routes.splice(this.routes.indexOf(drawingRouteService), 1);
            this.eventHelper.raiseEvent(<IDataChangedEventArgs>{});
        }

        public selectBaseLayer = (baseLayer: Services.IBaseLayer) => {
            if (baseLayer.selected) {
                return;
            }
            if (this.selectedBaseLayer) {
                this.map.removeLayer(this.selectedBaseLayer.layer);
                this.selectedBaseLayer.selected = false;
            }
            var newSelectedLayer = _.find(this.baseLayers,(layer) => layer.key == baseLayer.key);
            this.map.addLayer(newSelectedLayer.layer, true);
            newSelectedLayer.selected = true;
            this.selectedBaseLayer = newSelectedLayer;
        }

        public toggleOverlay = (overlay: IOvelay) => {
            var overlayFromArray = _.find(this.overlays,(overlayToFind) => overlayToFind.key == overlay.key);
            overlayFromArray.visible = !overlayFromArray.visible;
            if (overlayFromArray.visible) {
                this.map.addLayer(overlay.layer);
            } else {
                this.map.removeLayer(overlay.layer);
            }
        }

        public selectRoute = (routeName: string) => {
            var drawingRouteService = _.find(this.routes,(routeToFind) => routeToFind.name == routeName);
            if (drawingRouteService == null) {
                return;
            }
            if (drawingRouteService.active) {
                return;
            }

            if (this.selectedRoute) {
                this.selectedRoute.deactivate();
                this.selectedRoute.eventHelper.removeListener(this.dataChangedEventHandler);
            }
            this.selectedRoute = drawingRouteService;
            this.selectedRoute.activate();
            this.selectedRoute.eventHelper.addListener(this.dataChangedEventHandler);
            this.eventHelper.raiseEvent(<IDataChangedEventArgs>{});
        }

        private createRouteName = () => {
            var index = 0;
            var routeName = "Route " + index;
            while (_.any(this.routes,(route) => route.name == routeName)) {
                index++;
                routeName = "Route " + index;
            }
            return routeName;
        }

        private createPolyline(data: Common.RouteData): L.Polyline {
            var latlngs = <L.LatLng[]>[];
            for (var segmentIndex = 0; segmentIndex < data.segments.length; segmentIndex++) {
                var segment = data.segments[segmentIndex];
                for (var latlngIndex = 0; latlngIndex < segment.latlngs.length; latlngIndex++) {
                    latlngs.push(segment.latlngs[latlngIndex]);
                }
            }
            return L.polyline(latlngs, <L.PolylineOptions> { opacity: 0.5, color: "red", weight: 4 });
        }

        private addLayersFromLocalStorage = () => {
            var baseLayers = this.localStorageService.get<ILayerData[]>(LayersService.BASE_LAYERS_KEY) || [];
            for (var baseLayerIndex = 0; baseLayerIndex < baseLayers.length; baseLayerIndex++) {
                var baseLayerData = baseLayers[baseLayerIndex];
                this.addBaseLayer(baseLayerData.key, baseLayerData.address);
            }

            var overlays = this.localStorageService.get<ILayerData[]>(LayersService.OVERLAYS_KEY) || [];
            for (var overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
                var overlayData = overlays[overlayIndex];
                this.addOverlay(overlayData.key, overlayData.address);
            }
        }

        public getData = (): Common.RouteData[]=> {
            var routesData = <Common.RouteData[]>[];
            for (var routeIndex = 0; routeIndex < this.routes.length; routeIndex++) {
                var route = this.routes[routeIndex];
                var data = route.getData();
                data.name.replace(" ", "_");
                routesData.push(data);
            }
            return routesData;
        }

        public setData = (data: Common.RouteData[], reRoute: boolean) => {
            if (data.length == 0) {
                this.addRoute(this.createRouteName());
                return;
            }
            for (var routeIndex = 0; routeIndex < data.length; routeIndex++) {
                var route = data[routeIndex];
                this.addRoute(route.name.replace("_", " "), route, reRoute);
            }
        }

        public getSelectedRoute = (): DrawingRouteService => {
            return this.selectedRoute;
        }
    }
} 