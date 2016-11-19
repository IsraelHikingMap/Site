using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
using System.Web.Http.Description;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.IO;
using Newtonsoft.Json.Linq;

namespace IsraelHiking.API.Controllers
{
    public class SearchController : ApiController
    {
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IDataContainerConverterService _dataContainerConverterService;

        public SearchController(IElasticSearchGateway elasticSearchGateway, 
            IDataContainerConverterService dataContainerConverterService, 
            IElevationDataStorage elevationDataStorage)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _dataContainerConverterService = dataContainerConverterService;
            _elevationDataStorage = elevationDataStorage;
        }

        [ResponseType(typeof(FeatureCollection))]
        [HttpGet]
        // GET api/search/searchTerm=abc&language=en
        public async Task<FeatureCollection> GetSearchResults(string id, string language = null)
        {
            var fieldName = string.IsNullOrWhiteSpace(language) ? "name" : "name:" + language;
            var features = await _elasticSearchGateway.Search(id, fieldName);
            return new FeatureCollection(new Collection<IFeature>(features.OfType<IFeature>().ToList()));
        }

        [ResponseType(typeof(DataContainer))]
        [HttpPost]
        public async Task<DataContainer> PostConvertSearchResults(JObject content)
        {
            var name = "israelHiking";
            var feature = content.ToObject<Feature>(new GeoJsonSerializer());
            if (feature.Attributes.GetNames().Contains("name"))
            {
                name = feature.Attributes["name"].ToString();
            }
            var featureCollection = new FeatureCollection(new Collection<IFeature> {feature});
            var dataContainer = await _dataContainerConverterService.ToDataContainer(featureCollection.ToBytes(), name + ".geojson");
            foreach (var latLngZ in dataContainer.routes.SelectMany(routeData => routeData.segments.SelectMany(routeSegmentData => routeSegmentData.latlngzs)))
            {
                latLngZ.z = await _elevationDataStorage.GetElevation(latLngZ);
            }
            return dataContainer;
        }
    }
}
