namespace IsraelHiking.Common
{
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
        public const string INATURE = "iNature"; // HM TODO: Temp - remove me?
        public static readonly string[] Points = {
            WATER,
            VIEWPOINT,
            HISTORIC,
            CAMPING,
            NATURAL,
            WIKIPEDIA,
            OTHER,
            INATURE
        };

        public const string ROUTES = "Routes";

        public const string ROUTE_HIKE = "Hiking";
        public const string ROUTE_BIKE = "Bicycle";
        public const string ROUTE_4X4 = "4x4";

        public static readonly string[] Routes = {
            ROUTE_HIKE,
            ROUTE_BIKE,
            ROUTE_4X4
        };
    }

    public static class FeatureAttributes
    {
        public const string ID = "identifier";
        public const string NAME = "name";
        public const string DESCRIPTION = "description";
        public const string POI_PREFIX = "poi";
        public const string POI_COMBINED_IDS = POI_PREFIX + "CombinedIds";
        public const string POI_SOURCE = POI_PREFIX + "Source";
        public const string POI_CATEGORY = POI_PREFIX + "Category";
        public const string POI_LANGUAGE = POI_PREFIX + "Language";
        public const string POI_NAMES = POI_PREFIX + "Names";
        public const string POI_CONTAINER = POI_PREFIX + "Container";
        public const string POI_SHARE_REFERENCE = POI_PREFIX + "ShareReference";
        public const string OSM_NODES = "osmNodes";
        public const string WEBSITE = "website";
        public const string WIKIPEDIA = "wikipedia";
        public const string SEARCH_FACTOR = "searchFactor";
        public const string GEOLOCATION = "geolocation";
        public const string LAT = "lat";
        public const string LON = "lon";
        public const string ICON = "icon";
        public const string ICON_COLOR = "iconColor";
        public const string IMAGE_URL = "image";
        public const string SOURCE_IMAGE_URL = "sourceImageUrl";
    }

    public static class Sources
    {
        public const string OSM = "OSM";
        public const string OSM_ADDRESS = "https://www.openstreetmap.org/";
        public const string OSM_FILE_NAME = "israel-and-palestine-latest.osm.pbf";
        public const string NAKEB = "Nakeb";
        public const string OFFROAD = "Off-road";
        public const string WIKIPEDIA = "Wikipedia";
        public const string INATURE = "iNature";
    }

    public static class Languages
    {
        public const string ALL = "all";
        public const string HEBREW = "he";
        public const string ENGLISH = "en";
        public static readonly string[] Array =
        {
            HEBREW,
            ENGLISH
        };
    }
}
