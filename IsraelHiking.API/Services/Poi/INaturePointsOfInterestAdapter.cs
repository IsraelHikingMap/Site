using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Poi;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Converts points from INature to site's POIs
    /// </summary>
    public class INaturePointsOfInterestAdapter : BasePointsOfInterestAdapter
    {
        private readonly IINatureGateway _iNatureGateway;
        private readonly IRepository _repository;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="iNatureGateway"></param>
        /// <param name="repository"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public INaturePointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IDataContainerConverterService dataContainerConverterService, 
            IINatureGateway iNatureGateway,
            IRepository repository,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            IOptions<ConfigurationData> options,
            ILogger logger) : 
            base(elevationDataStorage, 
                elasticSearchGateway, 
                dataContainerConverterService, 
                itmWgs84MathTransfromFactory,
                options,
                logger)
        {
            _iNatureGateway = iNatureGateway;
            _repository = repository;
        }

        /// <inheritdoc />
        public override string Source => Sources.INATURE;

        /// <inheritdoc />
        public override async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            var featureCollection = await GetFromCacheIfExists(id);
            if (featureCollection == null)
            {
                featureCollection = await _iNatureGateway.GetById(id);
                SetToCache(featureCollection);
            }
            var poiItem = await ConvertToPoiExtended(featureCollection, language);
            poiItem.IsEditable = false;
            poiItem.IsArea = false;
            var mainFeature = featureCollection.Features.First();
            if (mainFeature.Attributes.Exists(FeatureAttributes.POI_SHARE_REFERENCE))
            {
                var share = await _repository.GetUrlById(mainFeature.Attributes[FeatureAttributes.POI_SHARE_REFERENCE].ToString());
                poiItem.DataContainer = share.DataContainer;
                var featureBytes = await _dataContainerConverterService.ToAnyFormat(share.DataContainer, FlowFormats.GEOJSON);
                poiItem.FeatureCollection = featureBytes.ToFeatureCollection();
                poiItem.IsRoute = true;
            }
            else
            {
                poiItem.IsRoute = false;
            }
            return poiItem;
        }

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Getting data from iNature.");
            var features = await _iNatureGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} points from iNature.");
            return features;
        }
    }
}
