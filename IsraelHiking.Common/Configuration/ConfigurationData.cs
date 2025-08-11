using System.Collections.Generic;

namespace IsraelHiking.Common.Configuration;

public class ConfigurationData
{
    /// <summary>
    /// True if you would like to write the merge report, false otherwise
    /// </summary>
    public bool WriteMergeReport { get; set; }
    /// <summary>
    /// The maximal number of points per line for splitting
    /// </summary>
    public int MaxNumberOfPointsPerLine { get; set; }
    /// <summary>
    /// The maximal length of a line for splitting
    /// </summary>
    public int MaxLengthPerLine { get; set; }
    /// <summary>
    /// The number of segments to split a route to when doing D-P
    /// </summary>
    public int MaxSegmentsNumber { get; set; }
    /// <summary>
    /// The minimal segment length when splitting a route for D-P in meters
    /// </summary>
    public double MinimalSegmentLength { get; set; }
    /// <summary>
    /// An initial value to start the route simplification D-P algorithm in meters
    /// </summary>
    public double InitialSplitSimplificationDistanceTolerance { get; set; }
    /// <summary>
    /// The minimal length of a part of a line in meters
    /// </summary>
    public double MinimalMissingPartLength { get; set; }
    /// <summary>
    /// The minimal length of a self loop part in meters to be considered as a new segment
    /// </summary>
    public double MinimalMissingSelfLoopPartLength { get; set; }
    /// <summary>
    /// The distance in meters for the radial simplification to consider a point within a radius and angle to simplify
    /// </summary>
    public double RadialDistanceTolerance { get; set; }
    /// <summary>
    /// The maximal distance that is considered the same line in meters
    /// </summary>
    public double MaxDistanceToExistingLineForMerge { get; set; }
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
    /// The minimal distance in meters allowed to treat a point as non part of an existing line
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
    /// This threshold in degrees that is used to determine if two points of interest are close enough to be merged
    /// </summary>
    public double MergePointsOfInterestThreshold { get; set; }
    /// <summary>
    /// This threshold in degrees that is used to determine if two points of interest are close enough to be merged
    /// assuming one is from an external source
    /// </summary>
    public double MergeExternalPointsOfInterestThreshold { get; set; }
    /// <summary>
    /// This threshold in degrees that is used to determine if two points of interest are close enough to be suggested when updating
    /// </summary>
    public double ClosestPointsOfInterestThreshold { get; set; }
    /// <summary>
    /// This distance to the closest highway for adding gates in degrees
    /// </summary>
    public double ClosestHighwayForGates { get; set; }
    /// <summary>
    /// This distance to the closest node for updating gates in degrees
    /// </summary>
    public double ClosestNodeForGates { get; set; }
    /// <summary>
    /// GraphHopper server address
    /// </summary>
    public string GraphhopperServerAddress { get; set; }
    /// <summary>
    /// Elasticsearch server address
    /// </summary>
    public string ElasticsearchServerAddress { get; set; }
    /// <summary>
    /// GPSBabel server address
    /// </summary>
    public string GpsBabelServerAddress { get; set; }
    /// <summary>
    /// Image creator server address
    /// </summary>
    public string ImageCreatorServerAddress { get; set; }
    /// <summary>
    /// A location where offline files are saved in order to allow them to be downloaded
    /// </summary>
    public string OfflineFilesFolder { get; set; }
    /// <summary>
    /// A location where offline files are saved in order to allow them to be downloaded
    /// </summary>
    public string ExternalFilesFolder { get; set; }
    /// <summary>
    /// OSM server base address
    /// </summary>
    public string OsmBaseAddress { get; set; }
    /// <summary>
    /// The API address of the share urls - cloud saves
    /// </summary>
    public string ShareUrlApiAddress { get; set; }
    /// <summary>
    /// OSM server base address
    /// </summary>
    public List<string> OverpassAddresses { get; set; }
    /// <summary>
    /// A list of allowed image sites
    /// </summary>
    public List<string> ImageUrlsAllowList { get; set; }
        
    /// <summary>
    /// A list of external sources - address and file name
    /// </summary>
    public Dictionary<string, string> CsvsDictionary { get; set; }

    public ConfigurationData()
    {
        WriteMergeReport = false;
        MaxSegmentsNumber = 40;
        InitialSplitSimplificationDistanceTolerance = 50;
        MaxDistanceToExistingLineForMerge = 5;
        MaxProlongLineLength = 350;
        MaxDistanceBetweenGpsRecordings = 50;
        MinimalSegmentLength = 500;
        MinimalDistanceToClosestPoint = 30;
        MinimalProlongLineLength = 10;
        MinimalAreaSize = 1000;
        SimplificationDistanceTolerance = 3;
        MinimalMissingPartLength = 200;
        MinimalMissingSelfLoopPartLength = MinimalDistanceToClosestPoint;
        RadialDistanceTolerance = 10;
        MaxNumberOfPointsPerLine = 1000;
        MaxLengthPerLine = 3000;
        RadialSimplificationAngle = 90;
        SearchFactor = 1;
        MergePointsOfInterestThreshold = 0.001; // around 100m
        MergeExternalPointsOfInterestThreshold = 1 / 60.0; // 1 minute
        ClosestPointsOfInterestThreshold = 0.001; // around 100m
        ClosestHighwayForGates = 0.0003; // around 30m
        ClosestNodeForGates = 0.00005; // around 5m
        GraphhopperServerAddress = "http://localhost:8989/";
        ElasticsearchServerAddress = "http://localhost:9200/";
        GpsBabelServerAddress = "http://localhost:11987/";
        ImageCreatorServerAddress = "http://localhost:11311/";
        OfflineFilesFolder = "./";
        ExternalFilesFolder = "./";
        OsmBaseAddress = "https://www.openstreetmap.org";
        ShareUrlApiAddress = "https://israelhiking.osm.org.il/api/urls/";
        ImageUrlsAllowList =
        [
            "wikimedia.org",
            "inature.info",
            "nakeb.co.il",
            "jeepolog.com"
        ];
        OverpassAddresses = ["https://z.overpass-api.de/api/interpreter", "https://lz4.overpass-api.de/api/interpreter"];
        CsvsDictionary = new Dictionary<string, string>();
    }
}