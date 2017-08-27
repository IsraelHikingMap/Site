export class IconsService {
    private static BACKGROUND = "<i class='fa icon-map-marker fa-stack-2x' style='color:white;text-shadow: 3px 3px 3px #000;'></i>";
    private static POI_BACKGROUND = "<i class='fa icon-map-marker-rect fa-stack-2x' style='color:white;text-shadow: 3px 3px 3px #000;'></i>";

    private static KM_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND +
    "<strong class='fa-stack-1x'>{{number}}</strong>" +
    "</span>";

    private static SEARCH_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND +
    "<i class='fa icon-search fa-stack-1x stack-icon-top' style='color:black;'></i>" +
    "</span>";

    private static START_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND +
    "<i class='fa icon-play-circle fa-stack-1x stack-icon-top' style='color:green;'></i>" +
    "</span>";

    private static END_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND +
    "<i class='fa icon-stop fa-stack-1x stack-icon-top' style='color:red;'></i>" +
    "</span>";

    private static ROUND_MARKER_HTML = "<span class='fa-stack' style='font-size: 8px;'>" +
    "<i class='fa icon-circle fa-stack-2x' style='color:{{color}};'></i>" +
    "<i class='fa icon-circle fa-stack-1x' style='color:white'></i>" +
    "</span>";

    private static TRACE_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND +
    "<i class='fa icon-cog fa-stack-1x stack-icon-top' style='color:blue;'></i>" +
    "</span>";

    private static MISSING_PART_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND +
    "<i class='fa icon-star fa-stack-1x stack-icon-top' style='color:orange;'></i>" +
    "</span>";

    private static COLOR_AND_TYPE_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
    IconsService.BACKGROUND.replace("white", "{{color}}") +
    "<i class='fa icon-{{type}} fa-stack-1x stack-icon-top' style='color:white;'></i>" +
    "</span>";

    private static POI_MARKER_HTML = "<span class='fa-stack fa-lg'>" +
        IconsService.POI_BACKGROUND +
        "<i class='fa {{icon}} fa-stack-1x stack-icon-top' style='color:{{color}};'></i>" +
        "</span>";

    public static getAvailableIconTypes() : string[]
    {
        return ["star", "arrow-left", "arrow-right", "tint",
            "car", "bike", "hike", "four-by-four",
            "bed", "viewpoint", "fire", "flag",
            "coffee", "cutlery", "shopping-cart", "tree"];
    }

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
        return IconsService.createMarkerIconWithColorAndType(color, IconsService.getAvailableIconTypes()[0]);
    }

    public static createMarkerIconWithColorAndType(color: string, type: string): L.DivIcon {
        let html = IconsService.COLOR_AND_TYPE_MARKER_HTML.replace("{{color}}", color).replace("{{type}}", type || IconsService.getAvailableIconTypes()[0]);
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
        return IconsService.createPoiIcon("icon-wikipedia-w", "black");
    }

    public static createNakebIcon(): L.DivIcon {
        return IconsService.createPoiIcon("icon-nakeb", "black");
    }

    public static createPoiIcon(icon: string, color: string): L.DivIcon {
        let html = IconsService.POI_MARKER_HTML.replace("{{icon}}", icon).replace("{{color}}", color);
        return L.divIcon(IconsService.getDefaultMarkerOptions(html));
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