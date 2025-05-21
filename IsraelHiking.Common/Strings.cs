using System.Linq;

namespace IsraelHiking.Common;

public static class Categories
{
    public const string POINTS_OF_INTEREST = "Points of Interest";

    public const string WATER = "Water";
    public const string VIEWPOINT = "Viewpoint";
    public const string HISTORIC = "Historic";
    public const string CAMPING = "Camping";
    public const string NATURAL = "Natural";
    public const string WIKIPEDIA = "Wikipedia";
    public const string OTHER = "Other";
    public const string NONE = "None";
    public const string INATURE = "iNature";

    public static readonly string[] Points =
    [
        WATER,
        VIEWPOINT,
        HISTORIC,
        CAMPING,
        NATURAL,
        WIKIPEDIA,
        OTHER,
        INATURE
    ];

    public const string ROUTES = "Routes";

    public const string ROUTE_HIKE = "Hiking";
    public const string ROUTE_BIKE = "Bicycle";
    public const string ROUTE_4X4 = "4x4";

    public static readonly string[] Routes =
    [
        ROUTE_HIKE,
        ROUTE_BIKE,
        ROUTE_4X4
    ];
}
    
public static class FeatureAttributes
{
    public const string ID = "identifier";
    public const string NAME = "name";
    public const string MTB_NAME = "mtb:name";
    public const string DESCRIPTION = "description";
    public const string IMAGE_URL = "image";
    public const string WEBSITE = "website";
    public const string WIKIPEDIA = "wikipedia";
    public const string WIKIDATA = "wikidata";
    public const string INATURE_REF = "ref:IL:inature";
    private const string POI_PREFIX = "poi";
    public const string POI_ID = POI_PREFIX + "Id";
    public const string POI_SOURCE = POI_PREFIX + "Source";
    public const string POI_CATEGORY = POI_PREFIX + "Category";
    public const string POI_LANGUAGE = POI_PREFIX + "Language";
    public const string POI_LANGUAGES = POI_PREFIX + "Languages";
    public const string POI_NAMES = POI_PREFIX + "Names";
    public const string POI_CONTAINER = POI_PREFIX + "Container";
    public const string POI_SHARE_REFERENCE = POI_PREFIX + "ShareReference";
    public const string POI_LAST_MODIFIED = POI_PREFIX + "LastModified";
    public const string POI_USER_NAME = POI_PREFIX + "UserName";
    public const string POI_USER_ADDRESS = POI_PREFIX + "UserAddress";
    public const string POI_SOURCE_IMAGE_URL = POI_PREFIX + "SourceImageUrl";
    public const string POI_SEARCH_FACTOR = POI_PREFIX + "SearchFactor";
    public const string POI_GEOLOCATION = POI_PREFIX + "Geolocation";
    public const string POI_ICON = POI_PREFIX + "Icon";
    public const string POI_ICON_COLOR = POI_PREFIX + "IconColor";
    public const string POI_OSM_NODES = POI_PREFIX + "OsmNodes";
    public const string POI_ALT = POI_PREFIX + "Alt";
    public const string POI_EXTERNAL_DESCRIPTION = POI_PREFIX + "ExternalDescription";
    public const string POI_VERSION = POI_PREFIX + "Version";
    public const string POI_IS_SIMPLE = POI_PREFIX + "IsSimple";
    public const string POI_TYPE = POI_PREFIX + "Type";
    public const string POI_ADDED_URLS = POI_PREFIX + "AddedUrls";
    public const string POI_REMOVED_URLS = POI_PREFIX + "RemovedUrls";
    public const string POI_ADDED_IMAGES = POI_PREFIX + "AddedImages";
    public const string POI_REMOVED_IMAGES = POI_PREFIX + "RemovedImages";
    public const string POI_MERGED = POI_PREFIX + "Merged";
        
    public static readonly string[] POI_DESCRIPTION_KEYS =
    [
        POI_EXTERNAL_DESCRIPTION,
        DESCRIPTION
    ];

    public const string LAT = "lat";
    public const string LON = "lon";
    public const double INVALID_LOCATION = -9999;
}

public static class Sources
{
    public const string OSM = "OSM";
    public const string NAKEB = "Nakeb";
    public const string WIKIPEDIA = "Wikipedia";
    public const string WIKIDATA = "Wikidata";
    public const string INATURE = "iNature";
}

public static class Languages
{
    public const string ALL = "all";
    public const string HEBREW = "he";
    public const string ENGLISH = "en";
    public const string RUSSIAN = "ru";
    public const string ARABIC = "ar";
    public const string DEFAULT = "default";
    public static readonly string[] Array =
    [
        HEBREW,
        ENGLISH,
        RUSSIAN,
        ARABIC
    ];
    public static readonly string[] ArrayWithDefault = new [] { DEFAULT }.Concat(Array).ToArray();
}

public static class Branding
{
    public static string SITE_NAME = "Mapeak";

    public static string DESCRIPTION =  "Whether you are planning your next hike, ride drive or run, this is where you can find everything you'll need in order to plan your next outdoor visit.";

    public const string ROUTE_SHARE_DEFAULT_TITLE = "Mapeak Route Share";

    // HM TODO: decide what to do with this
    public const string USER_AGENT =
        "Mapeak/5.x bot (https://www.mapeak.com; support@mapeak.com)";

    public const string BASE_URL = "https://www.mapeak.com";
}