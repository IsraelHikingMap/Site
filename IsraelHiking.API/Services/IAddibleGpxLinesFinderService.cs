using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public interface IAddibleGpxLinesFinderService
    {
        Task<IEnumerable<LineString>> GetLines(List<LineString> gpxLines);
    }
}