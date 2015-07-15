module IsraelHiking.Controllers {

    export class MainMapcontoller extends BaseMapController {
        controlCreatorService: Services.ControlCreatorService;

        constructor(mapService: Services.MapService,
            controlCreatorService: Services.ControlCreatorService,
            hashService: Services.HashService) {
            super(mapService);

            this.controlCreatorService = controlCreatorService;
            this.map = mapService.map;
            this.createControls();
        }

        private createControls = () => {

            (<any>L).control.locate({ icon: "fa fa-crosshairs" }).addTo(this.map);

            this.controlCreatorService.create(this.map, "file-control");
            this.controlCreatorService.create(this.map, "drawing-control");
            this.controlCreatorService.create(this.map, "edit-osm-control");
            this.controlCreatorService.create(this.map, "info-help-control");
            this.controlCreatorService.create(this.map, "layers-control", "topright");

            L.control.scale(<L.ScaleOptions> { imperial: false }).addTo(this.map);
            (<any>L).Control.geocoder({
                geocoder: (<any>L).Control.Geocoder.Nominatim({
                    geocodingQueryParams: { countrycodes: 'no' }
                })
            }).addTo(this.map);
        }
    }
} 