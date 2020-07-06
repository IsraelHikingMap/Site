using System.Collections.Generic;

namespace IsraelHiking.Common.Configuration
{
    public class ConfigurationData
    {
        /// <summary>
        /// Maximum time in seconds to keep a user in the cache
        /// </summary>
        public int MaxUserTimeInCache { get; set; }
        /// <summary>
        /// The maximal number of points per line for splitting
        /// </summary>
        public int MaxNumberOfPointsPerLine { get; set; }
        /// <summary>
        /// The maximal legnth of a line for splitting
        /// </summary>
        public int MaxLengthPerLine { get; set; }
        /// <summary>
        /// The number of segments to split a route to when doing D-P
        /// </summary>
        public int MaxSegmentsNumber { get; set; }
        /// <summary>
        /// The number of days to keep a point of interest in the cache.
        /// </summary>
        public int DaysToKeepPoiInCache { get; set; }
        /// <summary>
        /// The minimal segment legth when splitting a route for D-P in meters
        /// </summary>
        public double MinimalSegmentLength { get; set; }
        /// <summary>
        /// An initial value to start the route simplfication D-P algorithm in meters
        /// </summary>
        public double InitialSplitSimplificationDistanceTolerace { get; set; }
        /// <summary>
        /// The minimal legnth of a part of a line in meters
        /// </summary>
        public double MinimalMissingPartLength { get; set; }
        /// <summary>
        /// The minimal legnth of a self loop part in meters
        /// </summary>
        public double MinimalMissingSelfLoopPartLegth { get; set; }
        /// <summary>
        /// The maximal distance that is considered the same line in meters
        /// </summary>
        public double MaxDistanceToExisitngLineForMerge { get; set; }
        /// <summary>
        /// The maximal length before giving up the search to prolong a line in meters
        /// </summary>
        public double MaxProlongLineLength { get; set; }
        /// <summary>
        /// The maximal distance in meters before a recording is defined as bad and need to be split
        /// </summary>
        public double MaxDistanceBetweenGpsRecordings { get; set; }
        /// <summary>
        /// The radial simplification angle in degrees
        /// </summary>
        public double RadialSimplificationAngle { get; set; }
        /// <summary>
        /// The simplification distance for D-P for gpx lines in meters
        /// </summary>
        public double SimplificationDistanceTolerance { get; set; }
        /// <summary>
        /// The minimal distance allowed to treat a point as non part of an existing line
        /// </summary>
        public double MinimalDistanceToClosestPoint { get; set; }
        /// <summary>
        /// The minimal line length in meters that should be added when prolonging missing lines according to recorded GPX
        /// </summary>
        public double MinimalProlongLineLength { get; set; }
        /// <summary>
        /// The minimal area required for a prolong line that closes an area to have in meters^2
        /// </summary>
        public double MinimalAreaSize { get; set; }
        /// <summary>
        /// The default factor of less relevant OSM features
        /// </summary>
        public double SearchFactor { get; set; }
        /// <summary>
        /// This threshold is used to determine if two points of interest are close enough to be merged
        /// </summary>
        public double MergePointsOfInterestThreshold { get; set; }
        /// <summary>
        /// This threshold is used to determine if two points of interest are close enough to be suggested
        /// </summary>
        public double ClosestPointsOfInterestThreshold { get; set; }
        /// <summary>
        /// The folder where the binary files are at
        /// </summary>
        public string BinariesFolder { get; set; }
        /// <summary>
        /// GraphHopper server address
        /// </summary>
        public string GraphhopperServerAddress { get; set; }
        /// <summary>
        /// Elasticsearch server address
        /// </summary>
        public string ElasticsearchServerAddress { get; set; }
        /// <summary>
        /// The address of the OSM file to download for daily rebuild
        /// </summary>
        public string OsmFileAddress { get; set; }
        /// <summary>
        /// The address of the OSM file time stamp to update the osm file regarding its modification day and time 
        /// </summary>
        public string OsmFileTimeStampAddress { get; set; }
        /// <summary>
        /// The base address to fetch minutes updates for OSM. used by osm-c-tools
        /// </summary>
        public string OsmMinutsFileBaseAddress { get; set; }
        /// <summary>
        /// An object that describe how to connect to OSM
        /// </summary>
        public OsmConfiguraionData OsmConfiguration { get; set; }
        /// <summary>
        /// A list of directories that are visible to the user for folder navigation
        /// </summary>
        public Dictionary<string, string> ListingDictionary { get; set; }

        /// <summary>
        /// A list of reverse-proxies that the site will redirect
        /// </summary>
        public Dictionary<string, string> ProxiesDictionary { get; set; }
        /// <summary>
        /// A list of external sources - address and file name
        /// </summary>
        public Dictionary<string, string> CsvsDictionary { get; set; }
        /// <summary>
        /// A list of colors to select the route color from
        /// </summary>
        public List<string> Colors { get; set; }

        public ConfigurationData()
        {
            MaxUserTimeInCache = 20 * 60;
            MaxSegmentsNumber = 40;
            InitialSplitSimplificationDistanceTolerace = 50;
            MaxDistanceToExisitngLineForMerge = 5;
            MaxProlongLineLength = 350;
            MaxDistanceBetweenGpsRecordings = 50;
            MinimalSegmentLength = 500;
            MinimalDistanceToClosestPoint = 30;
            MinimalProlongLineLength = 10;
            MinimalAreaSize = 1000;
            SimplificationDistanceTolerance = 3;
            MinimalMissingPartLength = 200;
            MinimalMissingSelfLoopPartLegth = MinimalDistanceToClosestPoint;
            MaxNumberOfPointsPerLine = 1000;
            MaxLengthPerLine = 3000;
            RadialSimplificationAngle = 90;
            SearchFactor = 0.5;
            MergePointsOfInterestThreshold = 1 / 60.0; // 1 minute
            ClosestPointsOfInterestThreshold = 0.001; // around 100 m
            BinariesFolder = string.Empty;
            GraphhopperServerAddress = "http://localhost:8989/";
            ElasticsearchServerAddress = "http://localhost:9200/";
            OsmFileAddress = "http://download.openstreetmap.fr/extracts/asia/israel_and_palestine-latest.osm.pbf";
            OsmFileTimeStampAddress = "http://download.openstreetmap.fr/extracts/asia/israel_and_palestine.state.txt";
            OsmMinutsFileBaseAddress = "http://download.openstreetmap.fr/replication/asia/israel_and_palestine";
            OsmConfiguration = new OsmConfiguraionData
            {
                ConsumerKey = "E8p0RX0rnQPxDaj3IijgpMNeK8lRTyy6rlKxQ8IF",
                ConsumerSecret = "Hro40NSObALdx8Dm7Xv1mKvxjwlGITqetXUBYUwv",
                BaseAddress = "https://www.openstreetmap.org"
            };
            CsvsDictionary = new Dictionary<string, string>();
            ListingDictionary = new Dictionary<string, string>();
            ProxiesDictionary = new Dictionary<string, string>();
            Colors = new List<string>
            {
                "#0000FF", // blue
                "#FF0000", // red
                "#FF6600", // orange
                "#FF00DD", // pink
                "#008000", // green
                "#B700FF", // purple
                "#00B0A4", // turquize
                "#FFFF00", // yellow
                "#9C3E00", // brown
                "#00FFFF", // cyan
                "#7F8282", // gray
                "#101010", // dark
            };
        }
    }
}
