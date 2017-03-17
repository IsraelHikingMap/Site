﻿namespace IsraelHiking.Services {
    export class IconsService {
        private static BACKGROUND = "<i class='fa icon-map-marker fa-stack-2x' style='color:white;text-shadow: 3px 3px 3px #000;'></i>";

        private static KM_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<strong class='fa-stack-1x'>{{number}}</strong>" +
        "</span>";

        private static SEARCH_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<i class='fa fa-search fa-stack-1x stack-icon-top' style='color:black;'></i>" +
        "</span>";

        private static START_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<i class='fa fa-play-circle fa-stack-1x stack-icon-top' style='color:green;'></i>" +
        "</span>";

        private static END_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<i class='fa fa-stop fa-stack-1x stack-icon-top' style='color:red;'></i>" +
        "</span>";

        private static ROUND_MARKER_HTML = "<span class='fa-stack' style='font-size: 8px;'>" +
        "<i class='fa fa-circle fa-stack-2x' style='color:{{color}};'></i>" +
        "<i class='fa fa-circle fa-stack-1x' style='color:white'></i>" +
        "</span>";

        private static TRACE_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<i class='fa fa-cog fa-stack-1x stack-icon-top' style='color:blue;'></i>" +
        "</span>";

        private static MISSING_PART_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<i class='fa fa-star fa-stack-1x stack-icon-top' style='color:orange;'></i>" +
        "</span>";

        private static COLOR_AND_TYPE_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND.replace("white", "{{color}}") +
        "<i class='fa icon-{{type}} fa-stack-1x stack-icon-top' style='color:white;'></i>" +
        "</span>";

        private static WIKI_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.BACKGROUND +
        "<i class='fa fa-wikipedia-w fa-stack-1x stack-icon-top' style='color:black;'></i>" +
        "</span>";

        public static createRoundIcon(color: string): L.DivIcon {
            return L.divIcon({
                html: IconsService.ROUND_MARKER_HTML.replace("{{color}}", color),
                iconSize: L.point(16, 16),
                iconAnchor: L.point(8, 10),
                className: "round-marker"
            } as L.DivIconOptions);
        }

        public static createRouteMarkerIcon(color: string): L.DivIcon {
            return IconsService.createMarkerIconWithColorAndType(color, "arrows");
        }

        public static createPoiHoverMarkerIcon(color: string): L.DivIcon {
            return IconsService.createMarkerIconWithColorAndType(color, "plus");
        }

        public static createPoiDefaultMarkerIcon(color: string): L.DivIcon {
            return IconsService.createMarkerIconWithColorAndType(color, "star");
        }

        public static createMarkerIconWithColorAndType(color: string, type: string): L.DivIcon {
            let html = IconsService.COLOR_AND_TYPE_MARKER_HTML.replace("{{color}}", color).replace("{{type}}", type || "star");
            return L.divIcon(IconsService.getDefaultMarkerOptions(html));
        }

        public static createKmMarkerIcon(markerNumber: number): L.DivIcon {
            let html = IconsService.KM_MARKER_HTML.replace("{{number}}", markerNumber.toString());
            return L.divIcon(IconsService.getDefaultMarkerOptions(html));
        }

        public static createSearchMarkerIcon(): L.DivIcon {
            return L.divIcon(IconsService.getDefaultMarkerOptions(IconsService.SEARCH_MARKER_HTML));
        }

        public static createTraceMarkerIcon(): L.DivIcon {
            return L.divIcon(IconsService.getDefaultMarkerOptions(IconsService.TRACE_MARKER_HTML));
        }

        public static createMissingPartMarkerIcon(): L.DivIcon {
            return L.divIcon(IconsService.getDefaultMarkerOptions(IconsService.MISSING_PART_MARKER_HTML));
        }

        public static createStartIcon(): L.DivIcon {
            return L.divIcon(IconsService.getDefaultMarkerOptions(IconsService.START_MARKER_HTML));
        }

        public static createEndIcon(): L.DivIcon {
            return L.divIcon(IconsService.getDefaultMarkerOptions(IconsService.END_MARKER_HTML));
        }

        public static createWikipediaIcon(): L.DivIcon {
            return L.divIcon(IconsService.getDefaultMarkerOptions(IconsService.WIKI_MARKER_HTML));
        }

        private static getDefaultMarkerOptions(html: string) {
            return {
                html: html,
                iconSize: L.point(32, 32),
                iconAnchor: L.point(16, 32),
                className: "common-marker",
                popupAnchor: L.point(0, -30)
            } as L.DivIconOptions;
        }
    }
}