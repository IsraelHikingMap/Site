module IsraelHiking.Services {
    export class MapService {
        public map: L.Map;

        constructor() {
            this.map = L.map("map", <L.Map.MapOptions>{
                center: L.latLng(31.773, 35.12),
                zoom: 13,
                doubleClickZoom: false,
            });
        }
    }
}
 