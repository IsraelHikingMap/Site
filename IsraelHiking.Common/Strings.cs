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
        public static readonly string[] Points = {
            WATER,
            VIEWPOINT,
            HISTORIC,
            CAMPING,
            NATURAL,
            WIKIPEDIA,
            OTHER
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
        public const string POI_SOURCE = "poiSource";
        public const string POI_CATEGORY = "poiCategory";
        public const string OSM_TYPE = "osmType";
        public const string OSM_NODES = "osmNodes";
        public const string POI_LANGUAGE = "poiLanguage";
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
