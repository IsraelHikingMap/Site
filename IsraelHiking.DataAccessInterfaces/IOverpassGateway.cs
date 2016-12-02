using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using OsmSharp.Osm;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOverpassGateway
    {
        Task<List<CompleteWay>> GetHighways(LatLng northEast, LatLng southWest);
        Task<List<CompleteWay>> GetHighwaysAroundATrace(IEnumerable<Coordinate> coordinates);
    }
}