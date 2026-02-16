import { environment } from "../environments/environment";

export class Urls {
    public static readonly baseAddress = environment.baseAddress;
    public static readonly baseTilesAddress = environment.baseTilesAddress;
    public static readonly apiBase = environment.baseApiAddress;
    public static readonly emptyAuthHtml = Urls.baseAddress + "/empty-for-oauth.html";
    public static readonly mapeakAuthUrl = "mapeak://oauth_callback/";
    public static readonly translations = "translations/";
    public static readonly health = Urls.apiBase + "health/";
    public static readonly routing = Urls.apiBase + "routing";
    public static readonly files = Urls.apiBase + "files";
    public static readonly openFile = Urls.files + "/open";
    public static readonly offlineFiles = Urls.files + "/offline";
    public static readonly subscribed = Urls.files + "/subscribed";
    public static readonly search = Urls.apiBase + "search/";
    public static readonly missingParts = Urls.apiBase + "osm/";
    public static readonly uploadDataContainer = Urls.apiBase + "osm/trace/route/";
    public static readonly traceAsDataContainer = Urls.apiBase + "osm/trace/";
    public static readonly tracePicture = Urls.apiBase + "osm/trace/";
    public static readonly poi = Urls.apiBase + "points/";
    public static readonly poiClosest = Urls.poi + "closest/";
    public static readonly poiUpdates = Urls.poi + "updates/";
    public static readonly poiSimple = Urls.poi + "simple/";

    public static readonly urls = Urls.apiBase + "urls/";
    public static readonly userLayers = Urls.apiBase + "userLayers/";
    public static readonly permissions = Urls.apiBase + "user/permissions";

    public static readonly osmApi = "https://api.openstreetmap.org/api/0.6/";
    public static readonly osmUser = Urls.osmApi + "user/details.json";
    public static readonly osmGpx = Urls.osmApi + "gpx";
    public static readonly osmGpxFiles = Urls.osmApi + "user/gpx_files.json";
    public static readonly osmBase = "https://www.openstreetmap.org";
    public static readonly osmAuth = Urls.osmBase + "/oauth2";

    public static readonly overpassApi = "https://overpass-api.de/api/interpreter";

    public static readonly facebook = "https://www.facebook.com/sharer/sharer.php?u=";
    public static readonly waze = "https://www.waze.com/ul?navigate=yes&zoom=17&ll=";
    public static readonly tranlation = "https://mapeak.com/api/translation/translate";

    public static readonly HIKING_STYLE_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json";
    public static readonly MTB_STYLE_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-bike.json";
    public static readonly HEATMAP_STYLE_ADDRESS = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-traces.json";

    public static readonly ANDROID_APP_URL = "https://play.google.com/store/apps/details?id=com.mapeak";
    public static readonly IOS_APP_URL = "https://apps.apple.com/us/app/mapeak/id6751947875";
}
