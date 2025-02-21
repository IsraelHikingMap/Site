using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;
using OsmSharp.IO.API;

namespace IsraelHiking.API.Services.Osm;

/// <summary>
/// This class is responsible for adding a given line to OSM
/// </summary>
public interface IOsmLineAdderService
{
    /// <summary>
    /// Use this method to add a line to OSM, this algorithm tries to add the line to existing lines in OSM
    /// </summary>
    /// <param name="line">The line to add</param>
    /// <param name="tags">The tags to add to the line</param>
    /// <param name="osmGateway">OSM Gateway for OSM manipulations</param>
    /// <returns></returns>
    Task Add(LineString line, Dictionary<string, string> tags, IAuthClient osmGateway);
}