using System.Collections.Generic;

namespace IsraelHiking.Common.Configuration;

public class ConfigurationData
{
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
    /// This distance to the closest highway for adding gates in degrees
    /// </summary>
    public double ClosestHighwayForGates { get; set; }
    /// <summary>
    /// This distance to the closest node for updating gates in degrees
    /// </summary>
    public double ClosestNodeForGates { get; set; }
    /// <summary>
    /// This distance to the closest node to search for an existing gate in meters
    /// </summary>
    public double ClosestNodeWithGate { get; set; }
    /// <summary>
    /// Valhalla server address
    /// </summary>
    public string ValhallaServerAddress { get; set; }
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
    /// The base address of the "on-the-fly" service that generates and serves offline files (IHM-schema, IHM-code, global_points)
    /// </summary>
    public string OnTheFlyFilesAddress { get; set; }
    /// <summary>
    /// The base names of the offline files that are served from the "on-the-fly" service instead of the file system
    /// </summary>
    public List<string> OnTheFlyFileNames { get; set; }
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

    public ConfigurationData()
    {
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
        ClosestHighwayForGates = 0.0003; // around 30m
        ClosestNodeForGates = 0.0001; // around 10m
        ClosestNodeWithGate = 30;
        GraphhopperServerAddress = "http://localhost:8989/";
        ValhallaServerAddress = "http://localhost:8002/";
        ElasticsearchServerAddress = "http://localhost:9200/";
        GpsBabelServerAddress = "http://localhost:11987/";
        ImageCreatorServerAddress = "http://localhost:11223/";
        OfflineFilesFolder = "./";
        OnTheFlyFilesAddress = "https://mapeak.com/serve-extract/";
        OnTheFlyFileNames = ["IHM-schema", "IHM-code", "global_points"];
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
    }
}