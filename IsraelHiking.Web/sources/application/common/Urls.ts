export class Urls {
    // api
    public static readonly baseAddress = window.location.protocol + "//" + window.location.host;
    public static readonly apiBase = Urls.baseAddress + "/api/";
    public static readonly urls = Urls.apiBase + "urls/";
    public static readonly elevation = Urls.apiBase + "elevation";
    public static readonly routing = Urls.apiBase + "routing";
    public static readonly itmGrid = Urls.apiBase + "itmGrid";
    public static readonly files = Urls.apiBase + "files";
    public static readonly fileFormats = Urls.files + "/formats";
    public static readonly openFile = Urls.apiBase + "files/open";
    public static readonly search = Urls.apiBase + "search/";
    public static readonly images = Urls.apiBase + "images/";
    public static readonly uploadAnonymousImage = Urls.images + "anonymous/";
    public static readonly colors = Urls.images + "colors/";
    public static readonly translations = Urls.baseAddress + "/translations/";
    public static readonly osm = Urls.apiBase + "osm/";
    public static readonly osmConfiguration = Urls.osm + "configuration";
    public static readonly osmTrace = Urls.osm + "trace/";
    public static readonly userLayers = Urls.apiBase + "userLayers/";
    public static readonly poi = Urls.apiBase + "poi/";
    public static readonly poiCategories = Urls.poi + "categories/";
    public static readonly rating = Urls.apiBase + "rating/";

    public static readonly facebook = "http://www.facebook.com/sharer/sharer.php?u=";
    public static readonly whatsapp = "https://web.whatsapp.com/send?text=";
    // HM TODO: test if this work on mobile too
    // public static readonly whatsapp = "whatsapp://send?text=";

    public static readonly DEFAULT_TILES_ADDRESS = "/Tiles/{z}/{x}/{y}.png";
    public static readonly MTB_TILES_ADDRESS = "/mtbTiles/{z}/{x}/{y}.png";
    public static readonly OVERLAY_TILES_ADDRESS = "/OverlayTiles/{z}/{x}/{y}.png";
    public static readonly OVERLAY_MTB_ADDRESS = "/OverlayMTB/{z}/{x}/{y}.png";
}
