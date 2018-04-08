using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Converts points from INature to site's POIs
    /// </summary>
    public class INaturePointsOfInterestAdapter : BasePointsOfInterestAdapter, IPointsOfInterestAdapter
    {
        private readonly IINatureGateway _iNatureGateway;
        private readonly IRepository _repository;
        private readonly ILogger _logger;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="iNatureGateway"></param>
        /// <param name="repository"></param>
        /// <param name="logger"></param>
        public INaturePointsOfInterestAdapter(IElevationDataStorage elevationDataStorage, 
            IElasticSearchGateway elasticSearchGateway, 
            IDataContainerConverterService dataContainerConverterService, 
            IINatureGateway iNatureGateway,
            IRepository repository,
            ILogger logger) : 
            base(elevationDataStorage, elasticSearchGateway, dataContainerConverterService)
        {
            _iNatureGateway = iNatureGateway;
            _repository = repository;
            _logger = logger;
        }

        /// <inheritdoc />
        public string Source => Sources.INATURE;

        /// <inheritdoc />
        public async Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language)
        {
            IFeature feature = await _elasticSearchGateway.GetCachedItemById(id, Source);
            var poiItem = await ConvertToPoiItem<PointOfInterestExtended>(feature, language);
            await AddExtendedData(poiItem, feature, language);
            poiItem.IsEditable = false;
            poiItem.IsArea = false;
            if (feature.Attributes.Exists(FeatureAttributes.POI_SHARE_REFERENCE))
            {
                var share = await _repository.GetUrlById(feature.Attributes[FeatureAttributes.POI_SHARE_REFERENCE].ToString());
                poiItem.DataContainer = share.DataContainer;
                poiItem.IsRoute = true;
            }
            else
            {
                poiItem.IsRoute = false;
            }
            return poiItem;
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("iNature does not support adding.");
        }

        /// <inheritdoc />
        public Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language)
        {
            throw new Exception("iNature does not support updating.");
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetPointsForIndexing(Stream memoryStream)
        {
            _logger.LogInformation("Getting data from iNature.");
            //var features = await _elasticSearchGateway.GetCachedItems(Source);
            //if (!features.Any())
            //{
            var features = await _iNatureGateway.GetAll();
            //}
            await _elasticSearchGateway.CacheItems(features);
            _logger.LogInformation($"Got {features.Count} points from iNature.");
            return features;
        }
    }
}
