﻿using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Geometries;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Xml.Serialization;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc />
    public class DatabasesUpdaterService : IDatabasesUpdaterService
    {
        private readonly INonAuthClient _osmGateway;
        private readonly IExternalSourcesRepository _externalSourcesRepository;
        private readonly IPointsOfInterestRepository _pointsOfInterestRepository;
        private readonly IHighwaysRepository _highwaysRepository;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly ITagsHelper _tagsHelper;
        private readonly IOsmRepository _osmRepository;
        private readonly IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
        private readonly IPointsOfInterestProvider _pointsOfInterestProvider;
        private readonly IFeaturesMergeExecutor _featuresMergeExecutor;
        private readonly IOsmLatestFileGateway _osmLatestFileGateway;
        private readonly IPointsOfInterestFilesCreatorExecutor _pointsOfInterestFilesCreatorExecutor;
        private readonly IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
        private readonly IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;
        private readonly IElevationDataStorage _elevationDataStorage;
        private readonly ILogger _logger;
        /// <summary>
        /// Service's constructor
        /// </summary>
        /// <param name="clinetsFactory"></param>
        /// <param name="externalSourcesRepository"></param>
        /// <param name="pointsOfInterestRepository"></param>
        /// <param name="highwaysRepository"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="osmRepository"></param>
        /// <param name="pointsOfInterestAdapterFactory"></param>
        /// <param name="featuresMergeExecutor"></param>
        /// <param name="latestFileGateway"></param>
        /// <param name="pointsOfInterestFilesCreatorExecutor"></param>
        /// <param name="imagesUrlsStorageExecutor"></param>
        /// <param name="pointsOfInterestProvider"></param>
        /// <param name="externalSourceUpdaterExecutor"></param>
        /// <param name="elevationDataStorage"></param>
        /// <param name="logger"></param>
        public DatabasesUpdaterService(IClientsFactory clinetsFactory,
            IExternalSourcesRepository externalSourcesRepository,
            IPointsOfInterestRepository pointsOfInterestRepository,
            IHighwaysRepository highwaysRepository,
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor,
            ITagsHelper tagsHelper, IOsmRepository osmRepository,
            IPointsOfInterestAdapterFactory pointsOfInterestAdapterFactory,
            IFeaturesMergeExecutor featuresMergeExecutor,
            IOsmLatestFileGateway latestFileGateway,
            IPointsOfInterestFilesCreatorExecutor pointsOfInterestFilesCreatorExecutor,
            IImagesUrlsStorageExecutor imagesUrlsStorageExecutor,
            IPointsOfInterestProvider pointsOfInterestProvider,
            IExternalSourceUpdaterExecutor externalSourceUpdaterExecutor,
            IElevationDataStorage elevationDataStorage,
            ILogger logger)
        {
            _externalSourcesRepository = externalSourcesRepository;
            _pointsOfInterestRepository = pointsOfInterestRepository;
            _highwaysRepository = highwaysRepository;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _tagsHelper = tagsHelper;
            _osmRepository = osmRepository;
            _pointsOfInterestAdapterFactory = pointsOfInterestAdapterFactory;
            _pointsOfInterestFilesCreatorExecutor = pointsOfInterestFilesCreatorExecutor;
            _featuresMergeExecutor = featuresMergeExecutor;
            _osmLatestFileGateway = latestFileGateway;
            _pointsOfInterestProvider = pointsOfInterestProvider;
            _osmGateway = clinetsFactory.CreateNonAuthClient();
            _imagesUrlsStorageExecutor = imagesUrlsStorageExecutor;
            _externalSourceUpdaterExecutor = externalSourceUpdaterExecutor;
            _elevationDataStorage = elevationDataStorage;
            _logger = logger;
        }

        /// <inheritdoc />
        public async Task Update()
        {
            _logger.LogInformation("Staring updating from OSM change file");
            using var updatesStream = await _osmLatestFileGateway.GetUpdates();
            XmlSerializer serializer = new XmlSerializer(typeof(OsmChange));
            var changes = (OsmChange)serializer.Deserialize(updatesStream);
            await UpdateHighways(changes);
            await UpdatePointsOfInterest(changes);
            _logger.LogInformation("Finished updating from OSM change file");
        }

        private async Task UpdateHighways(OsmChange changes)
        {
            var deleteTasks = new List<Task>();
            foreach (var highwaysToRemove in changes.Delete.OfType<Way>())
            {
                var task = _highwaysRepository.DeleteHighwaysById(highwaysToRemove.GetId());
                deleteTasks.Add(task);
            }
            await Task.WhenAll(deleteTasks);
            var updateTasks = new List<Task<CompleteWay>>();
            foreach (var highwaysToUpdate in changes.Modify
                .Concat(changes.Create)
                .OfType<Way>()
                .Where(w => w.Tags != null && w.Tags.ContainsKey("highway")))
            {
                var task = _osmGateway.GetCompleteWay(highwaysToUpdate.Id.Value);
                updateTasks.Add(task);
            }
            var updatedWays = await Task.WhenAll(updateTasks);
            var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(updatedWays.ToList());
            await _highwaysRepository.UpdateHighwaysData(geoJsonHighways);
        }

        private async Task UpdatePointsOfInterest(OsmChange changes)
        {
            var deleteTasks = new List<Task>();
            var relevantTagsDictionary = _tagsHelper.GetAllTags();
            foreach (var poiToRemove in changes.Delete)
            {
                var task = _pointsOfInterestRepository.DeleteOsmPointOfInterestById(poiToRemove.GetId(), poiToRemove.TimeStamp);
                deleteTasks.Add(task);
            }
            await Task.WhenAll(deleteTasks);
            var updateTasks = new List<Task<ICompleteOsmGeo>>();
            foreach (var poiToUpdate in changes.Modify
                .Concat(changes.Create)
                .Where(o => IsRelevantPointOfInterest(o, relevantTagsDictionary)))
            {
                var task = _osmGateway.GetCompleteElement(poiToUpdate.Id.Value, poiToUpdate.Type);
                updateTasks.Add(task);
            }
            var allElemets = await Task.WhenAll(updateTasks);
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(allElemets.ToList());

            foreach (var poiToUpdate in changes.Modify
                .Where(o => IsRelevantPointOfInterest(o, relevantTagsDictionary)))
            {
                var featureFromDb = await _pointsOfInterestRepository.GetPointOfInterestById(poiToUpdate.GetId(), Sources.OSM);
                if (featureFromDb == null)
                {
                    continue;
                }
                var featureToUpdate = features.First(f => f.GetId().Equals(featureFromDb.GetId()));
                foreach (var attributeKey in featureFromDb.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.POI_PREFIX)))
                {
                    featureToUpdate.Attributes.AddOrUpdate(attributeKey, featureFromDb.Attributes[attributeKey]);
                }
                if (featureToUpdate.Geometry.OgcGeometryType == OgcGeometryType.Point &&
                    featureFromDb.Geometry.OgcGeometryType != OgcGeometryType.Point)
                {
                    featureToUpdate.Geometry = featureFromDb.Geometry;
                }
            }
            await _pointsOfInterestRepository.UpdatePointsOfInterestData(features);
        }

        private bool IsRelevantPointOfInterest(OsmGeo osm, List<KeyValuePair<string, string>> relevantTagsDictionary)
        {
            return osm.Tags != null && (osm.Tags.GetName() != string.Empty || osm.Tags.HasAny(relevantTagsDictionary));
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
                if (request.UpdateOsmFile || request.DownloadOsmFile)
                {
                    await _osmLatestFileGateway.Update(request.DownloadOsmFile, request.UpdateOsmFile);
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
            using var stream = await _osmLatestFileGateway.Get();
            var osmHighways = await _osmRepository.GetAllHighways(stream);
            var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
            await _highwaysRepository.UpdateHighwaysZeroDownTime(geoJsonHighways);

            _logger.LogInformation("Finished rebuilding highways database.");
        }

        private async Task RebuildImages()
        {
            _logger.LogInformation("Starting rebuilding images database.");
            using var stream = await _osmLatestFileGateway.Get();
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
            ElevationSetterHelper.SetElevation(features, _elevationDataStorage);
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
