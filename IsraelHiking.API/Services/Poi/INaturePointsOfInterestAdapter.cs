﻿using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// Converts points from INature to site's POIs
    /// </summary>
    public class INaturePointsOfInterestAdapter : IPointsOfInterestAdapter
    {
        private readonly IINatureGateway _iNatureGateway;
        private readonly IShareUrlsRepository _repository;
        private readonly IDataContainerConverterService _dataContainerConverterService;
        private readonly ILogger _logger;

        /// <summary>
        /// Class constructor
        /// </summary>
        /// <param name="dataContainerConverterService"></param>
        /// <param name="iNatureGateway"></param>
        /// <param name="repository"></param>
        /// <param name="logger"></param>
        public INaturePointsOfInterestAdapter(IDataContainerConverterService dataContainerConverterService,
            IINatureGateway iNatureGateway,
            IShareUrlsRepository repository,
            ILogger logger) 
        {
            _iNatureGateway = iNatureGateway;
            _repository = repository;
            _dataContainerConverterService = dataContainerConverterService;
            _logger = logger;
        }

        /// <inheritdoc />
        public string Source => Sources.INATURE;

        /// <inheritdoc />
        public async Task<List<Feature>> GetAll()
        {
            _logger.LogInformation("Getting data from iNature.");
            var features = await _iNatureGateway.GetAll();
            foreach (var feature in features)
            {
                await UpdateGeometry(feature);
            }
            _logger.LogInformation($"Got {features.Count} points from iNature.");
            return features;
        }

        private async Task UpdateGeometry(Feature feature)
        {
            if (!feature.Attributes.Exists(FeatureAttributes.POI_SHARE_REFERENCE))
            {
                return;
            }
            var share = await _repository.GetUrlById(feature.Attributes[FeatureAttributes.POI_SHARE_REFERENCE].ToString());
            if (share == null)
            {
                return;
            }
            var featureBytes = await _dataContainerConverterService.ToAnyFormat(share.DataContainer, FlowFormats.GEOJSON);
            var lineFeature = featureBytes.ToFeatureCollection().FirstOrDefault(f => f.Geometry is LineString || f.Geometry is MultiLineString) as Feature;
            feature.Geometry = lineFeature?.Geometry ?? feature.Geometry;
        }

        /// <inheritdoc />
        public async Task<List<Feature>> GetUpdates(DateTime lastModifiedDate)
        {
            return await _iNatureGateway.GetUpdates(lastModifiedDate);
        }
    }
}
