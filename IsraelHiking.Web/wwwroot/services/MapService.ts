namespace IsraelHiking.Services {
    export class MapService {
        private static ZOOM_KEY = "Zoom";
        private static LATLNG_KEY = "LatLng";

        public map: L.Map;

        constructor(localStorageService: angular.local.storage.ILocalStorageService) {
            let latlng = localStorageService.get<L.LatLng>(MapService.LATLNG_KEY) || new L.LatLng(31.773, 35.12);
            let zoom = localStorageService.get<number>(MapService.ZOOM_KEY) || 13;
            this.map = L.map("map", {
                center: latlng,
                zoom: zoom,
                doubleClickZoom: false,
                zoomControl: false
            } as L.Map.MapOptions);

            this.map.on("moveend", () => {
                localStorageService.set(MapService.LATLNG_KEY, this.map.getCenter());
                localStorageService.set(MapService.ZOOM_KEY, this.map.getZoom());
            });
        }
    }
}
 