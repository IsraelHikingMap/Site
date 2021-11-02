using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class ExternalSourceUpdaterExecutor : IExternalSourceUpdaterExecutor
    {
        private readonly IPointsOfInterestAdapterFactory _adaptersFactory;
        private readonly IElevationGateway _elevationGateway;
        private readonly IExternalSourcesRepository _externalSourcesRepository;
        private readonly ILogger _logger;
        private readonly MathTransform _wgs84ItmTransform;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="adaptersFactory"></param>
        /// <param name="elevationGateway"></param>
        /// <param name="externalSourcesRepository"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="logger"></param>
        public ExternalSourceUpdaterExecutor(IPointsOfInterestAdapterFactory adaptersFactory,
            IElevationGateway elevationGateway,
            IExternalSourcesRepository externalSourcesRepository,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            ILogger logger)
        {
            _adaptersFactory = adaptersFactory;
            _elevationGateway = elevationGateway;
            _externalSourcesRepository = externalSourcesRepository;
            _wgs84ItmTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task UpdateSource(string currentSource)
        {
            _logger.LogInformation($"Starting updating {currentSource}, getting new points...");
            var adapter = _adaptersFactory.GetBySource(currentSource);
            var exitingPois = await _externalSourcesRepository.GetExternalPoisBySource(currentSource);
            var lastModified = exitingPois.Any()
                    ? exitingPois.Select(f => f.GetLastModified()).Max()
                    : new DateTime();
            if (!exitingPois.Any())
            {
                _logger.LogWarning($"Source {currentSource} is empty! Try running external source rebuild to make sure the data is correct");
            }
            var features = await adapter.GetUpdates(lastModified);
            _logger.LogInformation($"Got {features.Count} points for {currentSource} that are new since last update");
            UpdateItmAndAltitude(features);
            await _externalSourcesRepository.AddExternalPois(features);
            _logger.LogInformation($"Finished updating {currentSource}, indexed {features.Count} points.");
        }

        /// <inheritdoc/>
        public async Task RebuildSource(string currentSource)
        {
            _logger.LogInformation($"Starting rebuilding {currentSource}, getting points...");
            var adapter = _adaptersFactory.GetBySource(currentSource);
            var features = await adapter.GetAll();
            _logger.LogInformation($"Got {features.Count} points for {currentSource}");
            UpdateItmAndAltitude(features);
            await _externalSourcesRepository.DeleteExternalPoisBySource(currentSource);
            await _externalSourcesRepository.AddExternalPois(features);
            _logger.LogInformation($"Finished rebuilding {currentSource}, indexed {features.Count} points.");
        }

        private void UpdateItmAndAltitude(List<Feature> features)
        {
            var coordinates = features.Select(f => f.GetLocation()).ToArray();
            var elevationValues = _elevationGateway.GetElevation(coordinates).Result;
            for (var index = 0; index < features.Count; index++)
            {
                var feature = features[index];
                var geoLocationCoordinate = feature.GetLocation();
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ALT, elevationValues[index]);
                var northEast = _wgs84ItmTransform.Transform(geoLocationCoordinate.X, geoLocationCoordinate.Y);
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ITM_EAST, (int) northEast.x);
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ITM_NORTH, (int) northEast.y);
            }
        }
    }
}
