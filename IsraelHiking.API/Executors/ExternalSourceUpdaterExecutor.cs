using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems.Transformations;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class ExternalSourceUpdaterExecutor : IExternalSourceUpdaterExecutor
    {
        private readonly IPointsOfInterestAdapterFactory _adaptersFactory;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly IExternalSourcesRepository _externalSourcesRepository;
        private readonly ILogger _logger;
        private readonly MathTransform _wgs84ItmTransform;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="adaptersFactory"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="externalSourcesRepository"></param>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        /// <param name="logger"></param>
        public ExternalSourceUpdaterExecutor(IPointsOfInterestAdapterFactory adaptersFactory,
            IElevationDataStorage elevationDataStorage,
            IExternalSourcesRepository externalSourcesRepository,
            IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory,
            ILogger logger)
        {
            _adaptersFactory = adaptersFactory;
            _elevationDataStorage = elevationDataStorage;
            _externalSourcesRepository = externalSourcesRepository;
            _wgs84ItmTransform = itmWgs84MathTransfromFactory.CreateInverse();
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task UpdateSource(string currentSource)
        {
            _logger.LogInformation($"Starting updating {currentSource}, getting points...");
            var adapter = _adaptersFactory.GetBySource(currentSource);
            var exitingPois = await _externalSourcesRepository.GetExternalPoisBySource(currentSource);
            var lastModified = exitingPois
                .Select(f => f.GetLastModified())
                .Max();
            var features = await adapter.GetUpdates(lastModified);
            _logger.LogInformation($"Got {features.Count} points for {currentSource}");
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
            foreach (var feature in features)
            {
                var geoLocation = feature.Attributes[FeatureAttributes.POI_GEOLOCATION] as AttributesTable;
                var geoLocationCoordinate = new Coordinate((double)geoLocation[FeatureAttributes.LON], (double)geoLocation[FeatureAttributes.LAT]);
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ALT, _elevationDataStorage.GetElevation(geoLocationCoordinate).Result);
                var northEast = _wgs84ItmTransform.Transform(geoLocationCoordinate.X, geoLocationCoordinate.Y);
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ITM_EAST, (int)northEast.x);
                feature.Attributes.AddOrUpdate(FeatureAttributes.POI_ITM_NORTH, (int)northEast.y);
            }
        }
    }
}
