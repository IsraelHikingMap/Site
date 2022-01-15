﻿using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using OsmSharp;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc />
    public class DatabasesUpdaterService : IDatabasesUpdaterService
    {
        private readonly IExternalSourcesRepository _externalSourcesRepository;
        private readonly IPointsOfInterestRepository _pointsOfInterestRepository;
        private readonly IHighwaysRepository _highwaysRepository;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly IOsmRepository _osmRepository;
        private readonly IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly IFeaturesMergeExecutor _featuresMergeExecutor;
        private readonly IOsmLatestFileGateway _osmLatestFileGateway;
        private readonly IPointsOfInterestFilesCreatorExecutor _pointsOfInterestFilesCreatorExecutor;
        private readonly IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private readonly IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;
        private readonly IElevationGateway _elevationGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Service's constructor
        /// </summary>
        /// <param name="externalSourcesRepository"></param>
        /// <param name="pointsOfInterestRepository"></param>
        /// <param name="highwaysRepository"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="osmRepository"></param>
        /// <param name="pointsOfInterestAdapterFactory"></param>
        /// <param name="featuresMergeExecutor"></param>
        /// <param name="latestFileGateway"></param>
        /// <param name="pointsOfInterestFilesCreatorExecutor"></param>
        /// <param name="imagesUrlsStorageExecutor"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="externalSourceUpdaterExecutor"></param>
        /// <param name="elevationGateway"></param>
        /// <param name="logger"></param>
        public DatabasesUpdaterService(IExternalSourcesRepository externalSourcesRepository,
            IPointsOfInterestRepository pointsOfInterestRepository,
            IHighwaysRepository highwaysRepository,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor, 
            IOsmRepository osmRepository,
            IPointsOfInterestAdapterFactory pointsOfInterestAdapterFactory,
            IFeaturesMergeExecutor featuresMergeExecutor,
            IOsmLatestFileGateway latestFileGateway,
            IPointsOfInterestFilesCreatorExecutor pointsOfInterestFilesCreatorExecutor,
            IImagesUrlsStorageExecutor imagesUrlsStorageExecutor,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IExternalSourceUpdaterExecutor externalSourceUpdaterExecutor,
            IElevationGateway elevationGateway,
            ILogger logger)
        {
            _externalSourcesRepository = externalSourcesRepository;
            _pointsOfInterestRepository = pointsOfInterestRepository;
            _highwaysRepository = highwaysRepository;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _osmRepository = osmRepository;
            _pointsOfInterestAdapterFactory = pointsOfInterestAdapterFactory;
            _pointsOfInterestFilesCreatorExecutor = pointsOfInterestFilesCreatorExecutor;
            _featuresMergeExecutor = featuresMergeExecutor;
            _osmLatestFileGateway = latestFileGateway;
            _pointsOfInterestProvider = pointsOfInterestProvider;
            _imagesUrlsStorageExecutor = imagesUrlsStorageExecutor;
            _externalSourceUpdaterExecutor = externalSourceUpdaterExecutor;
            _elevationGateway = elevationGateway;
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task Rebuild(UpdateRequest request)
        {
            // Order do matters in the sequence
            var rebuildContext = new RebuildContext
            {
                StartTime = DateTime.Now,
                Request = request,
                Succeeded = true
            };
            try
            {
                if (request.AllExternalSources)
                {
                    await UpdateExternalSources();
                }
                if (request.Highways)
                {
                    await RebuildHighways();
                }
                if (request.PointsOfInterest)
                {
                    await RebuildPointsOfInterest(rebuildContext);
                }
                if (request.Images)
                {
                    await RebuildImages();
                }
                if (request.SiteMap)
                {
                    await RebuildSiteMap();
                }
                if (request.OfflinePoisFile)
                {
                    await RebuildOfflinePoisFile(rebuildContext);
                }
            }
            catch (Exception ex)
            {
                rebuildContext.Succeeded = false;
                rebuildContext.ErrorMessage = ex.Message;
                _logger.LogError(ex, "Failed rebuilding databases");
            }
            finally
            {
                await _pointsOfInterestRepository.StoreRebuildContext(rebuildContext);
            }
            
        }

        private async Task RebuildPointsOfInterest(RebuildContext rebuildContext)
        {
            _logger.LogInformation("Starting rebuilding POIs database.");
            var osmFeaturesTask = _pointsOfInterestProvider.GetAll();
            var sources = _pointsOfInterestAdapterFactory.GetAll().Select(s => s.Source);
            var externalFeatures = sources.Select(s => _externalSourcesRepository.GetExternalPoisBySource(s)).SelectMany(t => t.Result).ToList();
            var features = _featuresMergeExecutor.Merge(osmFeaturesTask.Result, externalFeatures);
            _logger.LogInformation("Adding deleted features to new ones");
            var exitingFeatures = await _pointsOfInterestRepository.GetAllPointsOfInterest(true);
            var newFeaturesDictionary = features.ToDictionary(f => f.GetId(), f => f);
            var deletedFeatures = exitingFeatures.Where(f => f.GetLastModified() <= rebuildContext.StartTime && !newFeaturesDictionary.ContainsKey(f.GetId())).ToArray();
            foreach (var deletedFeatureToMark in deletedFeatures)
            {
                if (!deletedFeatureToMark.Attributes.Exists(FeatureAttributes.POI_DELETED))
                {
                    deletedFeatureToMark.Attributes.Add(FeatureAttributes.POI_DELETED, true);
                    deletedFeatureToMark.SetLastModified(DateTime.Now);
                    _logger.LogDebug("Removed feature id: " + deletedFeatureToMark.GetId());
                }
            }
            _logger.LogInformation("Added deleted features to new ones: " + deletedFeatures.Length);
            await _pointsOfInterestRepository.StorePointsOfInterestDataToSecondaryIndex(features.Concat(deletedFeatures).ToList());
            _logger.LogInformation("Getting all features added since rebuild started: " + rebuildContext.StartTime.ToLongTimeString());
            var addedFeaturesAfterRebuildStart = await _pointsOfInterestRepository.GetPointsOfInterestUpdates(rebuildContext.StartTime, DateTime.Now);
            _logger.LogInformation("Got all features added since rebuild started: " + addedFeaturesAfterRebuildStart.Count);
            await _pointsOfInterestRepository.StorePointsOfInterestDataToSecondaryIndex(addedFeaturesAfterRebuildStart);
            _logger.LogInformation("Finished storing all features");
            await _pointsOfInterestRepository.SwitchPointsOfInterestIndices();
            _logger.LogInformation("Finished rebuilding POIs database.");
        }

        private async Task RebuildHighways()
        {
            _logger.LogInformation("Starting rebuilding highways database.");
            await using var stream = await _osmLatestFileGateway.Get();
            var osmHighways = await _osmRepository.GetAllHighways(stream);
            var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
            await _highwaysRepository.UpdateHighwaysZeroDownTime(geoJsonHighways);

            _logger.LogInformation("Finished rebuilding highways database.");
        }

        private async Task RebuildImages()
        {
            _logger.LogInformation("Starting rebuilding images database.");
            await using var stream = await _osmLatestFileGateway.Get();
            var features = await _pointsOfInterestRepository.GetAllPointsOfInterest(false);
            var featuresUrls = features.SelectMany(f =>
                f.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                .Select(k => f.Attributes[k].ToString())
            );
            var urls = await _osmRepository.GetImagesUrls(stream);
            await _imagesUrlsStorageExecutor.DownloadAndStoreUrls(urls.Union(featuresUrls).ToList());
            _logger.LogInformation("Finished rebuilding images database.");
        }

        private async Task RebuildSiteMap()
        {
            _logger.LogInformation("Starting rebuilding sitemap.");
            var features = await _pointsOfInterestRepository.GetAllPointsOfInterest(false);
            _pointsOfInterestFilesCreatorExecutor.CreateSiteMapXmlFile(features);
            _logger.LogInformation("Finished rebuilding sitemap.");
        }

        private async Task RebuildOfflinePoisFile(RebuildContext context)
        {
            _logger.LogInformation($"Starting rebuilding offline pois file for date: {context.StartTime.ToInvariantString()}");
            var features = await _pointsOfInterestRepository.GetAllPointsOfInterest(false);
            features = features.Where(f => f.GetLastModified() <= context.StartTime).ToList();
            ElevationSetterHelper.SetElevation(features, _elevationGateway);
            _pointsOfInterestFilesCreatorExecutor.CreateOfflinePoisFile(features);
            _logger.LogInformation("Finished rebuilding offline pois file.");
        }

        private async Task UpdateExternalSources()
        {
            _logger.LogInformation("Starting updating external sources.");
            foreach (var source in _pointsOfInterestAdapterFactory.GetAll().Select(s => s.Source))
            {
                await _externalSourceUpdaterExecutor.UpdateSource(source);
            }
            _logger.LogInformation("Finished updating external sources.");
        }
    }
}
