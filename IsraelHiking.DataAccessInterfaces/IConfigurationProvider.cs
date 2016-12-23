using System.Collections.Generic;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IConfigurationProvider
    { 
        int MaxCacheSize { get; }
        int MaxNumberOfPointsPerLine { get; }
        int MaxSegmentsNumber { get; }
        double MinimalMissingPartLength { get; }
        double MinimalMissingSelfLoopPartLegth { get; }
        double MinimalSegmentLength { get; }
        double MinimalSplitSimplificationTolerace { get; }
        double RadialSimplificationAngle { get; }
        double SearchFactor { get; }
        double SimplificationTolerance { get; }
        double ClosestPointTolerance { get; }
        string BinariesFolder { get; }
        Dictionary<string, string> ListingDictionary { get; }
    }
}