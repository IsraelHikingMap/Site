using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public interface IGpxSplitterService
    {
        List<LineString> SplitSelfLoops(LineString gpxLine);
        List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings, double minimalMissingPartLength);
    }
}