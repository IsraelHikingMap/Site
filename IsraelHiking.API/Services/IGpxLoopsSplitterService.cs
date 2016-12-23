using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public interface IGpxLoopsSplitterService
    {
        List<LineString> SplitSelfLoops(LineString gpxLine, double closestPointTolerance);
        List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings, double minimalMissingPartLength, double closestPointTolerance);
    }
}