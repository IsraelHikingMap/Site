namespace IsraelHiking.Services {
    export class IconsService {
        private static KM_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        "<i class='fa fa-map-marker fa-3x fa-stack-2x' style='color:white;'></i>" +
        "<i class='fa fa-circle fa-stack-1x icon-background' style='color:white;'></i>" +
        "<strong class='fa-stack-1x'>{{number}}</strong>" +
        "</span>";

        private static SEARCH_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        "<i class='fa fa-map-marker fa-3x fa-stack-2x' style='color:white;'></i>" +
        "<i class='fa fa-circle fa-stack-2x icon-background' style='color:white;'></i>" +
        "<i class='fa fa-search fa-stack-1x icon-background' style='color:black;'></i>" +
        "</span>";

        private static START_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        "<i class='fa fa-map-marker fa-3x fa-stack-2x' style='color:white;'></i>" +
        "<i class='fa fa-circle fa-stack-2x icon-background' style='color:white;'></i>" +
        "<i class='fa fa-play-circle fa-stack-1x icon-background' style='color:green;'></i>" +
        "</span>";

        private static END_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        "<i class='fa fa-map-marker fa-3x fa-stack-2x' style='color:white;'></i>" +
        "<i class='fa fa-circle fa-stack-2x icon-background' style='color:white;'></i>" +
        "<i class='fa fa-stop fa-stack-1x icon-background' style='color:red;'></i>" +
        "</span>";

        private static ROUND_MARKER_HTML = "<span class='fa-stack' style='font-size: 8px;'>" +
        "<i class='fa fa-circle fa-stack-2x' style='color:{{color}};'></i>" +
        "<i class='fa fa-circle fa-stack-1x' style='color:white'></i>" +
        "</span>";

        private static COLOR_MARKER_HTML = "<i class='fa fa-map-marker fa-3x' style='color:{{color}};text-shadow: 3px 3px 3px #000;'></i>";

        public static createRoundIcon(color: string): L.DivIcon {
            return L.divIcon({
                html: IconsService.ROUND_MARKER_HTML.replace("{{color}}", color),
                iconSize: L.point(16, 16),
                iconAnchor: L.point(8, 10),
                className: "round-marker"
            } as L.DivIconOptions);
        }

        public static createMarkerIconWithColor(color: string): L.DivIcon {
            return L.divIcon({
                html: IconsService.COLOR_MARKER_HTML.replace("{{color}}", color),
                iconSize: L.point(20, 36),
                iconAnchor: L.point(10, 36),
                className: "color-marker",
                popupAnchor: L.point(0, -40),
                labelAnchor: L.point(-10, 20)
            } as L.DivIconOptions);
        }

        public static createKmMarkerIcon(markerNumber:number): L.DivIcon {
            return L.divIcon({
                html: IconsService.KM_MARKER_HTML.replace("{{number}}", markerNumber.toString()),
                iconSize: L.point(32, 32),
                iconAnchor: L.point(16, 32),
                className: "km-marker",
                popupAnchor: L.point(0, -30)
            } as L.DivIconOptions);
        }

        public static createSearchMarkerIcon(): L.DivIcon {
            return L.divIcon({
                html: IconsService.SEARCH_MARKER_HTML,
                iconSize: L.point(32, 32),
                iconAnchor: L.point(16, 32),
                className: "search-marker",
                popupAnchor: L.point(0, -30)
            } as L.DivIconOptions);
        }

        public static createStartIcon(): L.DivIcon {
            return IconsService.createIconFromHtml(IconsService.START_MARKER_HTML);
        }

        public static createEndIcon(): L.DivIcon {
            return IconsService.createIconFromHtml(IconsService.END_MARKER_HTML);
        }

        private static createIconFromHtml(html: string): L.DivIcon {
            return L.divIcon({
                html: html,
                iconSize: L.point(32, 32),
                iconAnchor: L.point(16, 32),
                className: "special-marker",
                popupAnchor: L.point(0, -30)
            } as L.DivIconOptions);
        }
    }
}