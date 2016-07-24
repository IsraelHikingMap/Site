namespace IsraelHiking.Services {

    export class ObjectWithMap {
        map: L.Map;

        constructor(mapService: Services.MapService) {
            this.map = mapService.map;
        }
    }
} 