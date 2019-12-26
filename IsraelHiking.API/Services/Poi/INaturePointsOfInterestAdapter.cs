using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
        /// <param name="dataContainerConverterService"></param>
        /// <param name="iNatureGateway"></param>
        /// <param name="repository"></param>
        /// <param name="logger"></param>
        public INaturePointsOfInterestAdapter(IDataContainerConverterService dataContainerConverterService,
            IINatureGateway iNatureGateway,
            IRepository repository,
            ILogger logger) : 
            base(dataContainerConverterService,
                logger)
        {
            _iNatureGateway = iNatureGateway;
            _repository = repository;
        }

        /// <inheritdoc />
        public override string Source => Sources.INATURE;

        /// <inheritdoc />
        public override async Task<List<Feature>> GetPointsForIndexing()
        {
            _logger.LogInformation("Getting data from iNature.");
            var features = await _iNatureGateway.GetAll();
            _logger.LogInformation($"Got {features.Count} points from iNature.");
            return features;
        }

        /// <inheritdoc />
        public override async Task<Feature> GetRawPointOfInterestById(string id)
        {
            var feature = await _iNatureGateway.GetById(id);
            if (!feature.Attributes.Exists(FeatureAttributes.POI_SHARE_REFERENCE))
            {
                return feature;
            }
            var share = await _repository.GetUrlById(feature.Attributes[FeatureAttributes.POI_SHARE_REFERENCE].ToString());
            if (share == null)
            {
                return feature;
            }
            var featureBytes = await _dataContainerConverterService.ToAnyFormat(share.DataContainer, FlowFormats.GEOJSON);
            var lineFeature = featureBytes.ToFeatureCollection().Features.FirstOrDefault(f => f.Geometry is LineString) as Feature;
            feature.Geometry = lineFeature?.Geometry ?? feature.Geometry;
            return feature;
        }
    }
}
