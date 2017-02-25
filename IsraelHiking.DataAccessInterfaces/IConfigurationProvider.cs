using System.Collections.Generic;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IConfigurationProvider
    { 
        int MaxCacheSize { get; }
        int MaxNumberOfPointsPerLine { get; }
        int MaxLengthPerLine { get; }
        int MaxSegmentsNumber { get; }
        double MinimalMissingPartLength { get; }
        double MinimalMissingSelfLoopPartLegth { get; }
        double MinimalSegmentLength { get; }
        double MinimalSplitSimplificationTolerace { get; }
        double DistanceToExisitngLineMergeThreshold { get; }
        double MaximalProlongLineLength { get; }
        double RadialSimplificationAngle { get; }
        double SearchFactor { get; }
        double SimplificationTolerance { get; }
        double ClosestPointTolerance { get; }
        string BinariesFolder { get; }
        OsmConfiguraionData OsmConfiguraion { get; set; }
        
        Dictionary<string, string> ListingDictionary { get; }
    }
}