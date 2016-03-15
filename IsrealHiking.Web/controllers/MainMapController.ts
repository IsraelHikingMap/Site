module IsraelHiking.Controllers {

    export class MainMapcontoller extends BaseMapController {
        $rootScope: angular.IRootScopeService;
        $compile: angular.ICompileService;

        constructor($rootScope: angular.IRootScopeService,
            $compile: angular.ICompileService,
            mapService: Services.MapService,
            hashService: Services.HashService) {
            super(mapService);

            this.map = mapService.map;
            this.map.setZoom(hashService.zoom);
            this.map.panTo(hashService.latlng);
            this.$compile = $compile;
            this.$rootScope = $rootScope;
            this.createControls();

            this.map.on("moveend",(e: L.LeafletEvent) => {
                hashService.updateLocation(this.map.getCenter(), this.map.getZoom());
            });
        }

        private createControls = () => {
            (L as any).control.locate({ icon: "fa fa-crosshairs", keepCurrentZoomLevel: true, follow: true }).addTo(this.map);

            this.createContorl("drawing-control");
            this.createContorl("edit-osm-control");
            this.createContorl("info-help-control");
            this.createContorl("search-control", "topright");
            this.createContorl("file-control", "topright");
            this.createContorl("convert-fromat-control", "topright");
            this.createContorl("share-control", "topright");
            this.createContorl("layers-control", "topright");

            L.control.scale({ imperial: false } as L.ScaleOptions).addTo(this.map);
        }

        /**
         * Creates a control on the leaflet map
         * 
         * @param directiveHtmlName - the dricetive html string
         * @param position - the position to place the control: topleft/topright/bottomleft/bottomright
         */
        private createContorl(directiveHtmlName: string, position = "topleft") {
            var control = L.Control.extend({
                options: {
                    position: position
                } as L.ControlOptions,
                onAdd: (): HTMLElement => {
                    var controlDiv = angular.element("<div>")
                        .addClass(directiveHtmlName + "-container")
                        .append(this.$compile(`<${directiveHtmlName}></${directiveHtmlName}>`)(this.$rootScope.$new()));
                    return controlDiv[0];
                },
                onRemove: () => { }
            } as L.ClassExtendOptions);
            new control().addTo(this.map);
        }
    }
} 
