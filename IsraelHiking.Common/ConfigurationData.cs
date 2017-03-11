using System.Collections.Generic;

namespace IsraelHiking.Common
{
    public class ConfigurationData
    {
        public int MaxCacheSize { get; set; }
        public int MaxNumberOfPointsPerLine { get; set; }
        public int MaxLengthPerLine { get; set; }
        public int MaxSegmentsNumber { get; set; }
        public double MinimalMissingPartLength { get; set; }
        public double MinimalMissingSelfLoopPartLegth { get; set; }
        public double MinimalSegmentLength { get; set; }
        public double MinimalSplitSimplificationTolerace { get; set; }
        public double DistanceToExisitngLineMergeThreshold { get; set; }
        public double MaximalProlongLineLength { get; set; }
        public double RadialSimplificationAngle { get; set; }
        public double SearchFactor { get; set; }
        public double SimplificationTolerance { get; set; }
        public double ClosestPointTolerance { get; set; }
        public string BinariesFolder { get; set; }
        public OsmConfiguraionData OsmConfiguraion { get; set; }
        public Dictionary<string, string> ListingDictionary { get; set; }

        public ConfigurationData()
        {
            MaxCacheSize = 200; // number 
            MaxSegmentsNumber = 40; // number
            MinimalSplitSimplificationTolerace = 50; // meters
            DistanceToExisitngLineMergeThreshold = 5; // meters
            MaximalProlongLineLength = 350; // meters
            MinimalSegmentLength = 500; // meters
            ClosestPointTolerance = 30; // meters
            SimplificationTolerance = 3; // meters
            MinimalMissingPartLength = 200; // meters
            MinimalMissingSelfLoopPartLegth = ClosestPointTolerance; // meters
            MaxNumberOfPointsPerLine =  1000; // number
            MaxLengthPerLine = 3000; // meters
            RadialSimplificationAngle = 90; // degrees
            SearchFactor = 0.5; // number
            BinariesFolder = string.Empty;
            OsmConfiguraion = new OsmConfiguraionData
            {
                ConsumerKey = "H5Us9nv9eDyFpKbBTiURf7ZqfdBArNddv10n6R6U",
                ConsumerSecret = "ccYaQUKLz26XEzbNd8uWoQ6HwbcnrUUp8milXnXG",
                BaseAddress ="https://www.openstreetmap.org"
            };
        }
    }
}
