module IsraelHiking.Controllers {

    export class MainMapcontoller extends BaseMapController {
        controlCreatorService: Services.ControlCreatorService;

        constructor(mapService: Services.MapService,
            controlCreatorService: Services.ControlCreatorService,
            hashService: Services.HashService) {
            super(mapService);

            this.controlCreatorService = controlCreatorService;
            this.map = mapService.map;
            this.map.setZoom(hashService.zoom);
            this.map.panTo(hashService.latlng);

            this.createControls();

            this.map.on("moveend",(e: L.LeafletEvent) => {
                hashService.updateLocation(this.map.getCenter(), this.map.getZoom());
            });
        }

        private createControls = () => {

            (<any>L).control.locate({ icon: "fa fa-crosshairs", keepCurrentZoomLevel: true }).addTo(this.map);

            this.controlCreatorService.create(this.map, "drawing-control");
            this.controlCreatorService.create(this.map, "edit-osm-control");
            this.controlCreatorService.create(this.map, "info-help-control");
            this.controlCreatorService.create(this.map, "search-control", "topright");
            this.controlCreatorService.create(this.map, "file-control", "topright");
            this.controlCreatorService.create(this.map, "convert-fromat-control", "topright");
            this.controlCreatorService.create(this.map, "share-control", "topright");
            this.controlCreatorService.create(this.map, "layers-control", "topright");

            L.control.scale(<L.ScaleOptions> { imperial: false }).addTo(this.map);

            
        }
    }
} 