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
            (L as any).control.locate({ icon: "fa fa-crosshairs", keepCurrentZoomLevel: true, follow: true }).addTo(this.map);

            this.controlCreatorService.create("drawing-control");
            this.controlCreatorService.create("edit-osm-control");
            this.controlCreatorService.create("info-help-control");
            this.controlCreatorService.create("search-control", "topright");
            this.controlCreatorService.create("file-control", "topright");
            this.controlCreatorService.create("convert-fromat-control", "topright");
            this.controlCreatorService.create("share-control", "topright");
            this.controlCreatorService.create("layers-control", "topright");

            L.control.scale({ imperial: false } as L.ScaleOptions).addTo(this.map);
        }
    }
} 
