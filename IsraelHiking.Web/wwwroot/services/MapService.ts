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
                zoomControl: false,
                keyboard: false,
            } as L.MapOptions);

            this.map.on("moveend", () => {
                localStorageService.set(MapService.LATLNG_KEY, this.map.getCenter());
                localStorageService.set(MapService.ZOOM_KEY, this.map.getZoom());
            });
        }

        public static setMarkerTitle(marker: Common.IMarkerWithTitle, title: string, color: string = ""): string {
            marker.unbindTooltip();
            marker.title = title || "";
            if (!title) {
                return;
            }
            let lines = title.split("\n");
            var htmlTitleArray = "";
            var container = angular.element("<div>");
            for (let line of lines) {
                if (!line) {
                    continue;
                }
                // start with hebrew or not, ignoring non alphabetical characters.
                let direction = (line.match(/^[^a-zA-Z]*[\u0591-\u05F4]/)) ? "rtl" : "ltr";
                var htmlLine = angular.element("<div>").attr("dir", direction).append(line);
                if (color) {
                    htmlLine.css("color", color);
                }
                container.append(htmlLine);
            }
            let html = container.wrap("<div></div>").html();
            marker.bindTooltip(html, { permanent: true, direction: "bottom" } as L.TooltipOptions);
        }
    }
}
 