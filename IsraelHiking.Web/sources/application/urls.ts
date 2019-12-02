import { environment } from "../environments/environment";

export class Urls {
    public static readonly baseAddress = environment.baseAddress;
    public static readonly baseTilesAddress = environment.baseTilesAddress;
    public static readonly apiBase = environment.baseApiAddress;
    public static readonly proxy = Urls.baseAddress + "/proxy/";
    public static readonly emptyHtml = Urls.baseAddress + "/empty-for-oauth.html";
    public static readonly translations = "translations/";
    public static readonly urls = Urls.apiBase + "urls/";
    public static readonly elevation = Urls.apiBase + "elevation";
    public static readonly routing = Urls.apiBase + "routing";
    public static readonly itmGrid = Urls.apiBase + "itmGrid";
    public static readonly files = Urls.apiBase + "files";
    public static readonly fileFormats = Urls.files + "/formats";
    public static readonly openFile = Urls.apiBase + "files/open";
    public static readonly search = Urls.apiBase + "search/";
    public static readonly images = Urls.apiBase + "images/";
    public static readonly colors = Urls.images + "colors/";
    public static readonly osm = Urls.apiBase + "osm/";
    public static readonly osmConfiguration = Urls.osm + "configuration";
    public static readonly osmTrace = Urls.osm + "trace/";
    public static readonly osmClosest = Urls.osm + "closest/";
    public static readonly osmUser = Urls.osm + "details/";
    public static readonly userLayers = Urls.apiBase + "userLayers/";
    public static readonly poi = Urls.apiBase + "poi/";
    public static readonly poiCategories = Urls.poi + "categories/";

    public static readonly facebook = "http://www.facebook.com/sharer/sharer.php?u=";

    public static readonly DEFAULT_TILES_ADDRESS = "/Tiles/{z}/{x}/{y}.png";
    public static readonly MTB_TILES_ADDRESS = "/mtbTiles/{z}/{x}/{y}.png";
    public static readonly OVERLAY_TILES_ADDRESS = "/OverlayTiles/{z}/{x}/{y}.png";
    public static readonly OVERLAY_MTB_ADDRESS = "/OverlayMTB/{z}/{x}/{y}.png";
}
