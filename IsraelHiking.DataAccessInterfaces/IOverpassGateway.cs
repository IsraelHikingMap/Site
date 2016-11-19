using System.Collections.Generic;
using System.Threading.Tasks;
using IsraelHiking.Common;
using OsmSharp.Osm;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOverpassGateway
    {
        Task<List<CompleteWay>> GetHighways(LatLng northEast, LatLng southWest);
    }
}