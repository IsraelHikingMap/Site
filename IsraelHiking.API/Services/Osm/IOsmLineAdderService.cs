using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services.Osm
{
    public interface IOsmLineAdderService
    {
        Task Add(LineString line, Dictionary<string, string> tags, TokenAndSecret tokenAndSecret);
    }
}