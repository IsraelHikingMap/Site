using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Geometries;
using OsmSharp.Complete;

namespace IsraelHiking.DataAccessInterfaces;

public interface IOverpassTurboGateway
{
    Task<List<CompleteWay>> GetHighways(Coordinate northEast, Coordinate southWest);
    Task<Dictionary<string, List<string>>> GetExternalReferences();
    Task<List<string>> GetImagesUrls();
}