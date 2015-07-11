declare module L {
    export class Google { new() }
}

module IsraelHiking.Controllers {

    export class MainMapcontoller extends BaseMapController {
        controlCreatorService: Services.ControlCreatorService;
        layerSwitcher: L.Control.Layers;
        defaultLayer: L.TileLayer;

        constructor(mapService: Services.MapService,
            controlCreatorService: Services.ControlCreatorService,
            hashService: Services.HashService) {
            super(mapService);
            this.controlCreatorService = controlCreatorService;
            this.map = mapService.map;
            this.ctreateLayers();
            this.map.addLayer(this.defaultLayer);
            this.createControls();
        }

        private ctreateLayers = () => {
            // HM TODO: get date

            //$http({
            //    type: "GET",
            //    async: true,
            //    timeout: 5000,
            //    url: "index.html",
            //    dataType: "html"
            //}).success(function (data, status, headers: Function, config) {
            //    var date = new Date(headers()['last-modified']);
                
            //});

            var lastModified = "08/07/2015";//(typeof getLastModifiedDate == "function") ? getLastModifiedDate() : document.lastModified;
            var attribution = "Map data &copy; <a href='http://openstreetmap.org' target='_blank'>OpenStreetMap</a> contributors, <a href='http://creativecommons.org/licenses/by-sa/2.0/' target='_blank\">CC-BY-SA</a>, built with <a href='http://getbootstrap.com/' target='_blank'>Bootstrap</a>. Last update: " + lastModified;

            var tileLayerOptions = <L.TileLayerOptions> {
                minZoom: 7,
                maxZoom: 16,
                attribution: attribution
            }
            
            var googleLayer = new L.Google();
            //this.defaultLayer = L.tileLayer("Tiles/{z}/{x}/{y}.png", tileLayerOptions);
            //var israelMTBLayer = L.tileLayer("mtbTiles/{z}/{x}/{y}.png", tileLayerOptions);
            //var overlayLayer = L.tileLayer("OverlayTiles/{z}/{x}/{y}.png", tileLayerOptions);

            this.defaultLayer = L.tileLayer("http://www.osm.org.il/IsraelHiking/Tiles/{z}/{x}/{y}.png", tileLayerOptions);
            var israelMTBLayer = L.tileLayer("http://www.osm.org.il/IsraelHiking/mtbTiles/{z}/{x}/{y}.png", tileLayerOptions);
            var overlayLayer = L.tileLayer("http://www.osm.org.il/IsraelHiking/OverlayTiles/{z}/{x}/{y}.png", tileLayerOptions);

            this.layerSwitcher = new L.Control.Layers({
                "Israel Hiking map": this.defaultLayer,
                "Israel MTB map": israelMTBLayer,
                "Google": googleLayer
            });
            this.layerSwitcher.addOverlay(overlayLayer, "Hiking trails");
        }

        private createControls = () => {

            (<any>L).control.locate({ icon: "fa fa-crosshairs" }).addTo(this.map);

            this.controlCreatorService.create(this.map, "file-control");
            this.controlCreatorService.create(this.map, "drawing-control");
            this.controlCreatorService.create(this.map, "edit-osm-control");
            this.controlCreatorService.create(this.map, "info-help-control");

            //for (var mapServiceIndex = 0; mapServiceIndex < this.mapServices.length; mapServiceIndex++) {
            //    var mapService = this.mapServices[mapServiceIndex];
            //    this.controlCreatorService.create(this.map, mapService);
            //}

            L.control.scale(<L.ScaleOptions> { imperial: false }).addTo(this.map);
            this.layerSwitcher.addTo(this.map);

            (<any>L).Control.geocoder({
                geocoder: (<any>L).Control.Geocoder.Nominatim({
                    geocodingQueryParams: { countrycodes: 'no' }
                })
            }).addTo(this.map);

            
        }
    }
} 