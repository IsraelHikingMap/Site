declare module L {
    export class Google { new() }
}

module IsraelHiking.Services {
    export interface ILayer {
        key: string;
        layer: L.TileLayer;
    }

    export interface IBaseLayer extends ILayer {
        selected: boolean
    }

    export interface IOvelay extends ILayer {
        visible: boolean;
    }

    export interface IRoute {
        key: string;
        active: boolean;
        routeData: Common.RouteData;
        polyline: L.Polyline;
    }

    export class LayersService extends ObjectWithMap {
        private static ISRAEL_HIKING_MAP = "Israel Hiking map";
        private static ISRAEL_MTB_MAP = "Israel MTB map";
        private static GOOGLE_MAP = "Google map";
        private static HIKING_TRAILS = "Hiking trails";
        private static ATTRIBUTION = "Map data &copy; <a href='http://openstreetmap.org' target='_blank'>OpenStreetMap</a> contributors, <a href='http://creativecommons.org/licenses/by-sa/2.0/' target='_blank\">CC-BY-SA</a>, built with <a href='http://getbootstrap.com/' target='_blank'>Bootstrap</a>. Last update: ";

        private tileLayerOptions: L.TileLayerOptions;
        private drawingRouteService: DrawingRouteService;
        private overlayZIndex;

        public baseLayers: IBaseLayer[];
        public overlays: IOvelay[];
        public routes: IRoute[];

        public selectedBaseLayer: IBaseLayer;
        public selectedRoute: IRoute;

        constructor(mapService: MapService, drawingRouteService: DrawingRouteService) {
            super(mapService);
            this.drawingRouteService = drawingRouteService;
            this.selectedBaseLayer = null;
            this.selectedRoute = null;
            this.baseLayers = [];
            this.overlays = [];
            this.routes = [];
            this.overlayZIndex = 10;
            var lastModified = "17/07/2015";//(typeof getLastModifiedDate == "function") ? getLastModifiedDate() : document.lastModified;
            this.tileLayerOptions = <L.TileLayerOptions> {
                minZoom: 7,
                maxZoom: 16,
                attribution: LayersService.ATTRIBUTION + lastModified
            };

            this.baseLayers.push(<IBaseLayer> { key: LayersService.GOOGLE_MAP, layer: <any>new L.Google(), selected: false });
            this.addBaseLayer(LayersService.ISRAEL_MTB_MAP, "http://www.osm.org.il/IsraelHiking/mtbTiles/{z}/{x}/{y}.png");
            //this.addBaseLayer(LayersService.ISRAEL_MTB_MAP, "mtbTiles/{z}/{x}/{y}.png");
            this.addBaseLayer(LayersService.ISRAEL_HIKING_MAP, "http://www.osm.org.il/IsraelHiking/Tiles/{z}/{x}/{y}.png");
            //this.addBaseLayer(LayersService.ISRAEL_HIKING_MAP, "Tiles/{z}/{x}/{y}.png");
            
            this.addOverlay(LayersService.HIKING_TRAILS, "http://www.osm.org.il/IsraelHiking/OverlayTiles/{z}/{x}/{y}.png");

            //this.addRoute("untitled");
        }

        public addBaseLayer = (key: string, address: string) => {
            if (_.find(this.baseLayers,(layerToFind) => layerToFind.key == key)) {
                return; // layer exists
            }
            var layer = <IBaseLayer>{ key: key, layer: L.tileLayer(address, this.tileLayerOptions), selected: false };
            this.baseLayers.push(layer);
            this.selectBaseLayer(layer)
        }

        public addOverlay = (key: string, address: string) => {
            if (_.find(this.overlays,(overlayToFind) => overlayToFind.key == key)) {
                return; // overlay exists
            }
            var overlay = <IOvelay>{ key: key, layer: L.tileLayer(address, this.tileLayerOptions), visible: false };
            overlay.layer.setZIndex(this.overlayZIndex++);
            this.overlays.push(overlay);
            this.toggleOverlay(overlay)
        }

        public addRoute = (key: string, routeData?: Common.RouteData) => {
            if (_.find(this.routes,(routeToFind) => routeToFind.key == key)) {
                return; // route exists
            }
            var route = <IRoute> {
                key: key,
                active: false,
                polyline: null,
                routeData: routeData || <Common.RouteData> {
                    routingType: Common.routingType.none,
                    segments: [],
                },
            };
            this.routes.push(route);
            this.selectRoute(route);
        }

        public removeBaseLayer = (baseLayer: Services.IBaseLayer) => {
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
            if (overlay.visible) {
                this.map.removeLayer(overlay.layer);
            }
            _.remove(this.overlays,(overlayToRemove) => overlayToRemove.key == overlay.key);
        }

        public removeRoute = (route: IRoute) => {
            if (route.active) {
                this.drawingRouteService.clear();
            } else if (route.polyline != null) {
                this.map.removeLayer(route.polyline);
            }
            _.remove(this.routes,(routeToRemove) => routeToRemove.key == route.key);

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

        public selectRoute = (route: IRoute) => {
            if (route.active) {
                return;
            }
            if (this.selectedRoute) {
                this.selectedRoute.active = false;
                this.selectedRoute.routeData = this.drawingRouteService.getData();
                this.selectedRoute.polyline = this.createPolyline(this.selectedRoute.routeData);
                this.map.addLayer(this.selectedRoute.polyline);
            }

            this.drawingRouteService.clear();
            this.drawingRouteService.setData(route.routeData);
            this.selectedRoute = route;
            this.selectedRoute.active = true;
            if (this.selectedRoute.polyline) {
                this.map.removeLayer(this.selectedRoute.polyline);
            }
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
    }
} 