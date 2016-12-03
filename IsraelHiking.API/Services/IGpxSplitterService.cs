using System.Collections.Generic;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public interface IGpxSplitterService
    {
        //List<LineString> Split(List<LineString> gpxLines, IReadOnlyList<LineString> existingLineStrings);
        List<LineString> SplitSelfLoops(LineString gpxLine);
        List<LineString> GetMissingLines(LineString gpxLine, IReadOnlyList<LineString> existingLineStrings);
    }
}