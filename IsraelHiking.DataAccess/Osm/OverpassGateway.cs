using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Osm;
using OsmSharp.Osm.Cache;
using OsmSharp.Osm.Streams.Complete;
using OsmSharp.Osm.Xml.Streams;

namespace IsraelHiking.DataAccess.Osm
{
    public class OverpassGateway : IOverpassGateway
    {
        private const string OVERPASS_INTERPRETER_ADDRESS = "http://overpass-api.de/api/interpreter";

        public async Task<List<CompleteWay>> GetHighways(LatLng northEast, LatLng southWest)
        {
            var boundsString = string.Join(",", southWest.lat, southWest.lng, northEast.lat, northEast.lng);
            var address = $"{OVERPASS_INTERPRETER_ADDRESS}?data=(way[\"highway\"]({boundsString});>;);out;";
            using (var client = new HttpClient())
            {
                var response = await client.GetAsync(address);
                var source = new XmlOsmStreamSource(await response.Content.ReadAsStreamAsync());
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                return completeSource.OfType<CompleteWay>().ToList();
            }
        }

        public async Task<List<CompleteWay>> GetHighwaysAroundATrace(IEnumerable<Coordinate> coordinates)
        {
            var overpassQueryPostfix = @"way[highway](bn)-> .w;
                                        node(w.w)-> .n;
                                        (node._.n; way.w);
                                        out qt; ";
            var overpassQueryNodes = "";
            foreach (var coordinate in coordinates)
            {
                // lat, lng
                overpassQueryNodes += $"(._; node(around: 300, {coordinate.Y}, {coordinate.X}););\n";
            }

            using (var client = new HttpClient())
            {
                var response = await client.PostAsync(OVERPASS_INTERPRETER_ADDRESS, new StringContent(overpassQueryNodes + overpassQueryPostfix));
                Trace.WriteLine(await response.Content.ReadAsStringAsync());
                var source = new XmlOsmStreamSource(await response.Content.ReadAsStreamAsync());
                var cache = new OsmDataCacheMemory();
                var completeSource = new OsmSimpleCompleteStreamSource(source, cache);
                var list = completeSource.OfType<CompleteWay>().ToList();
                return list;
            }
        }
    }
}