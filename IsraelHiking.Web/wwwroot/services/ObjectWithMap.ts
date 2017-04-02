namespace IsraelHiking.Services {

    export class ObjectWithMap {
        public map: L.Map;

        constructor(mapService: Services.MapService) {
            this.map = mapService.map;
        }
    }
} 