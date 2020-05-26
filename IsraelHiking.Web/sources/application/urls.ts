import { environment } from "../environments/environment";

export class Urls {
    public static readonly baseAddress = environment.baseAddress;
    public static readonly baseTilesAddress = environment.baseTilesAddress;
    public static readonly apiBase = environment.baseApiAddress;
    public static readonly emptyHtml = Urls.baseAddress + "/empty-for-oauth.html";
    public static readonly slimGeoJSON = Urls.baseAddress + "/pois-slim.geojson";
    public static readonly translations = "translations/";
    public static readonly urls = Urls.apiBase + "urls/";
    public static readonly elevation = Urls.apiBase + "elevation";
    public static readonly routing = Urls.apiBase + "routing";
    public static readonly itmGrid = Urls.apiBase + "itmGrid";
    public static readonly files = Urls.apiBase + "files";
    public static readonly openFile = Urls.files + "/open";
    public static readonly offlineFiles = Urls.files + "/offline";
    public static readonly search = Urls.apiBase + "search/";
    public static readonly images = Urls.apiBase + "images/";
    public static readonly osm = Urls.apiBase + "osm/";
    public static readonly osmConfiguration = Urls.osm + "configuration";
    public static readonly osmTrace = Urls.osm + "trace/";
    public static readonly osmUser = Urls.osm + "details/";
    public static readonly userLayers = Urls.apiBase + "userLayers/";
    public static readonly poi = Urls.apiBase + "poi/";
    public static readonly poiCategories = Urls.poi + "categories/";
    public static readonly poiClosest = Urls.poi + "closest/";

    public static readonly facebook = "http://www.facebook.com/sharer/sharer.php?u=";
    public static readonly waze = "https://www.waze.com/ul?navigate=yes&zoom=17&ll=";

    public static readonly DEFAULT_TILES_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/IHM.json";
    public static readonly MTB_TILES_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/ilMTB.json";
}
