using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Osm;
using OsmSharp.Osm.Streams.Complete;
using OsmSharp.Osm.Xml.Streams;

namespace IsraelHiking.DataAccess
{
    public class OverpassGateway : IOverpassGateway
    {
        public async Task<List<CompleteWay>> GetHighways(LatLng northEast, LatLng southWest)
        {
            var boundsString = string.Join(",", southWest.lat, southWest.lng, northEast.lat, northEast.lng);
            var address = $"http://overpass-api.de/api/interpreter?data=(way[\"highway\"]({boundsString});>;);out;";
            using (var client = new HttpClient())
            {
                var response = await client.GetAsync(address);
                var source = new XmlOsmStreamSource(await response.Content.ReadAsStreamAsync());
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                return completeSource.OfType<CompleteWay>().ToList();
            }
        }
    }
}
