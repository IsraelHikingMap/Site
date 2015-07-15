declare module L {
    export class Google { new() }
}

module IsraelHiking.Services {
    export interface IKeyLayer {
        key: string;
        layer: L.ILayer;
    }

    export class LayersService {
        private layers: IKeyLayer[];
        private overlays: IKeyLayer[];
        private routes: IKeyLayer[];
        private selectedLayerKey: string;
        private map: L.Map;

        constructor(mapService: MapService) {

            this.map = mapService.map;

            var lastModified = "08/07/2015";//(typeof getLastModifiedDate == "function") ? getLastModifiedDate() : document.lastModified;
            var attribution = "Map data &copy; <a href='http://openstreetmap.org' target='_blank'>OpenStreetMap</a> contributors, <a href='http://creativecommons.org/licenses/by-sa/2.0/' target='_blank\">CC-BY-SA</a>, built with <a href='http://getbootstrap.com/' target='_blank'>Bootstrap</a>. Last update: " + lastModified;

            var tileLayerOptions = <L.TileLayerOptions> {
                minZoom: 7,
                maxZoom: 16,
                attribution: attribution
            }

            var googleLayer = <any>new L.Google();
            //this.selectedLayer = L.tileLayer("Tiles/{z}/{x}/{y}.png", tileLayerOptions);
            //var israelMTBLayer = L.tileLayer("mtbTiles/{z}/{x}/{y}.png", tileLayerOptions);
            //var overlayLayer = L.tileLayer("OverlayTiles/{z}/{x}/{y}.png", tileLayerOptions);

            var israelHikingMap = L.tileLayer("http://www.osm.org.il/IsraelHiking/Tiles/{z}/{x}/{y}.png", tileLayerOptions);
            var israelMTBLayer = L.tileLayer("http://www.osm.org.il/IsraelHiking/mtbTiles/{z}/{x}/{y}.png", tileLayerOptions);
            var overlayLayer = L.tileLayer("http://www.osm.org.il/IsraelHiking/OverlayTiles/{z}/{x}/{y}.png", tileLayerOptions);

            this.layers = [];
            this.layers.push(<IKeyLayer>{ key: "Israel Hiking map", layer: israelHikingMap });
            this.layers.push(<IKeyLayer>{ key: "Israel MTB map", layer: israelMTBLayer });
            this.layers.push(<IKeyLayer>{ key: "Google", layer: googleLayer });

            this.overlays = [];
            this.overlays.push(<IKeyLayer>{ key: "Hiking trails", layer: overlayLayer });

            this.routes = [];
            this.routes.push(<IKeyLayer>{ key: "Some route from file", layer: null });
            this.selectedLayerKey = null;
            this.setSelectedLayer("Israel Hiking map");
            this.toggleOverlay("Hiking trails", true);
        }

        public getLayersNames = (): string[]=> {
            var names = [];
            for (var layerIndex = 0; layerIndex < this.layers.length; layerIndex++) {
                names.push(this.layers[layerIndex].key);
            }
            return names;
        }

        public getSelectedLayer = (): IKeyLayer => {
            return _.find(this.layers,(layer) => layer.key == this.selectedLayerKey);
        };

        public setSelectedLayer = (key: string) => {
            if (this.selectedLayerKey) {
                this.map.removeLayer(this.getSelectedLayer().layer);
            }
            var newSelectedLayer = _.find(this.layers,(layer) => layer.key == key);
            this.map.addLayer(newSelectedLayer.layer);
            this.selectedLayerKey = newSelectedLayer.key;
        }

        public getOverlaysNames = (): string[]=> {
            var names = [];
            for (var overlayIndex = 0; overlayIndex < this.overlays.length; overlayIndex++) {
                names.push(this.overlays[overlayIndex].key);
            }
            return names;
        }

        public getRouteNames = (): string[]=> {
            var names = [];
            for (var routeIndex = 0; routeIndex < this.routes.length; routeIndex++) {
                names.push(this.routes[routeIndex].key);
            }
            return names;
        }

        public toggleOverlay = (key: string, show: boolean) => {
            var overlay = _.find(this.overlays,(overlayToFind) => overlayToFind.key == key);
            if (show) {
                this.map.addLayer(overlay.layer);
            } else {
                this.map.removeLayer(overlay.layer);
            }
        }


    }
} 