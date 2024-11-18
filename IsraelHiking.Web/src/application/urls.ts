import { environment } from "../environments/environment";

export class Urls {
    // HM TODO: change this when website is in a different domain
    public static readonly baseAddress = environment.baseAddress;
    /*
    public static readonly baseTilesAddress = environment.baseTilesAddress;
    public static readonly apiBase = environment.baseApiAddress;
    public static readonly emptyAuthHtml = Urls.baseAddress + "/empty-for-oauth.html";
    public static readonly ihmAuthUrl = "ihm://oauth_callback/";
    public static readonly translations = "translations/";
    public static readonly urls = Urls.apiBase + "urls/";
    public static readonly health = Urls.apiBase + "health/";
    public static readonly elevation = Urls.apiBase + "elevation";
    public static readonly routing = Urls.apiBase + "routing";
    public static readonly files = Urls.apiBase + "files";
    public static readonly openFile = Urls.files + "/open";
    public static readonly offlineFiles = Urls.files + "/offline";
    public static readonly search = Urls.apiBase + "search/";
    public static readonly images = Urls.apiBase + "images/";
    public static readonly osm = Urls.apiBase + "osm/";
    public static readonly osmTrace = Urls.osm + "trace/";
    public static readonly osmTraceRoute = Urls.osmTrace + "route";
    public static readonly osmUser = Urls.osm + "details/";
    public static readonly userLayers = Urls.apiBase + "userLayers/";
    public static readonly poi = Urls.apiBase + "points/";
    public static readonly poiCategories = Urls.poi + "categories/";
    public static readonly poiClosest = Urls.poi + "closest/";
    public static readonly poiUpdates = Urls.poi + "updates/";
    public static readonly poiSimple = Urls.poi + "simple/";
    public static readonly poisOfflineFile = Urls.baseAddress + "/PointsOfInterest/pois.zip";
    */
    // HM TODO: change this on the mobile definitions?
    public static readonly mobileAuthUrl = "ihm://oauth_callback/";
    public static readonly OSM_API = "https://api.openstreetmap.org/api/0.6/";
    public static readonly user = Urls.OSM_API + "user/details.json";
    public static readonly traces = Urls.OSM_API + "user/gpx_files.json";
    public static readonly traceGPX = Urls.OSM_API + 'gpx/';
    public static readonly translations = "translations/";
    // HM TODO: this needs a server...?
    public static readonly emptyAuthHtml = window.location.origin + "/empty-for-oauth.html";
    public static readonly health = "https://www.google.com/";
    public static readonly elevation = "https://valhalla1.openstreetmap.de/height";

    public static readonly facebook = "https://www.facebook.com/sharer/sharer.php?u=";
    public static readonly waze = "https://www.waze.com/ul?navigate=yes&zoom=17&ll=";
    public static readonly osmBase = "https://www.openstreetmap.org";
    public static readonly osmAuth = Urls.osmBase + "/oauth2";

    public static readonly DEFAULT_TILES_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/IHM.json";
    public static readonly MTB_TILES_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/ilMTB.json";
    public static readonly HEATMAP_TILES_ADDRESS =
        "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/OSM_traces.json";
}
