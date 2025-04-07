using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;
using OsmSharp.Complete;

namespace IsraelHiking.DataAccessInterfaces.Repositories;

public interface IHighwaysRepository
{
    Task<List<CompleteWay>> GetHighways(Coordinate northEast, Coordinate southWest);
}