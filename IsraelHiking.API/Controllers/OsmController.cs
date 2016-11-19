using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using IsraelHiking.API.Converters;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Controllers
{
    public class OsmController : ApiController
    {
        private readonly IOverpassGateway _overpassGateway;
        private readonly IOsmGeoJsonConverter _osmGeoJsonConverter;

        public OsmController(IOverpassGateway overpassGateway, IOsmGeoJsonConverter osmGeoJsonConverter)
        {
            _overpassGateway = overpassGateway;
            _osmGeoJsonConverter = osmGeoJsonConverter;
        }

        public async Task<List<Feature>> GetHighways(string northEast, string southWest)
        {
            var highways = await _overpassGateway.GetHighways(new LatLng(northEast), new LatLng(southWest));
            return highways.Select(_osmGeoJsonConverter.ToGeoJson).Where(g => g != null).ToList();
        }
    }
}
