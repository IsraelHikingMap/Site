namespace IsraelHiking.Common
{
    public static class Categories
    {
        public const string OTHER = "Other";
        public const string VIEWPOINT = "Viewpoint";
        public const string CAMPSITE = "Campsite";
        public const string SPRING = "Spring";
        public const string RUINS = "Ruins";
        public const string NONE = "None";
        public static readonly string[] All = {
            SPRING,
            VIEWPOINT,
            RUINS,
            CAMPSITE,
            OTHER
        };
    }

    public static class FeatureAttributes
    {
        public const string ID = "identifier";
        public const string NAME = "name";
        public const string DESCRIPTION = "description";
        public const string POI_SOURCE = "poiSource";
        public const string OSM = "OSM";
        public const string EXTERNAL_URL = "externalUrl";
        public const string SEARCH_FACTOR = "searchFactor";
        public const string GEOLOCATION = "geolocation";
        public const string LAT = "lat";
        public const string LON = "lon";
        public const string POI_CATEGORY = "poiCategory";
        public const string ICON = "icon";
        public const string ICON_COLOR = "iconColor";
    }
}
