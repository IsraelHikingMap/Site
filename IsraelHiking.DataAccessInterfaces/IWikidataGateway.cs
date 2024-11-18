using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.DataAccessInterfaces;

public interface IWikidataGateway
{
    Task<List<IFeature>> GetByBoundingBox(Coordinate southWest, Coordinate northEast);
}