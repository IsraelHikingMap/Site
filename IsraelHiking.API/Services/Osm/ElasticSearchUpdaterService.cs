using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;

namespace IsraelHiking.API.Services.Osm
{
    /// <inheritdoc />
    public class ElasticSearchUpdaterService : IElasticSearchUpdaterService
    {
        private readonly IOsmGateway _osmGateway;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly ITagsHelper _tagsHelper;
        private readonly IOsmRepository _osmRepository;
        private readonly IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
        private readonly IFeaturesMergeExecutor _featuresMergeExecutor;
        private readonly IOsmLatestFileFetcherExecutor _latestFileFetcherExecutor;
        private readonly IGraphHopperGateway _graphHopperGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Service's constructor
        /// </summary>
        /// <param name="factory"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="osmRepository"></param>
        /// <param name="pointsOfInterestAdapterFactory"></param>
        /// <param name="featuresMergeExecutor"></param>
        /// <param name="latestFileFetcherExecutor"></param>
        /// <param name="graphHopperGateway"></param>
        /// <param name="logger"></param>
        public ElasticSearchUpdaterService(IHttpGatewayFactory factory, 
            IElasticSearchGateway elasticSearchGateway, 
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor, 
            ITagsHelper tagsHelper, IOsmRepository osmRepository,
            IPointsOfInterestAdapterFactory pointsOfInterestAdapterFactory,
            IFeaturesMergeExecutor featuresMergeExecutor,
            IOsmLatestFileFetcherExecutor latestFileFetcherExecutor,
            IGraphHopperGateway graphHopperGateway,
            ILogger logger)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _tagsHelper = tagsHelper;
            _osmRepository = osmRepository;
            _pointsOfInterestAdapterFactory = pointsOfInterestAdapterFactory;
            _logger = logger;
            _featuresMergeExecutor = featuresMergeExecutor;
            _latestFileFetcherExecutor = latestFileFetcherExecutor;
            _graphHopperGateway = graphHopperGateway;
            _osmGateway = factory.CreateOsmGateway(new TokenAndSecret("", ""));
        }

        /// <inheritdoc />
        public async Task Update(OsmChange changes)
        {
            _logger.LogInformation("Staring updating from OSM change file");
            await Updatehighways(changes);
            await UpdatePointsOfInterest(changes);
            _logger.LogInformation("Finished updating from OSM change file");
        }

        private async Task Updatehighways(OsmChange changes)
        {
            var deleteTasks = new List<Task>();
            foreach (var highwaysToRemove in changes.Delete.OfType<Way>())
            {
                var task = _elasticSearchGateway.DeleteHighwaysById(highwaysToRemove.Id.ToString());
                deleteTasks.Add(task);
            }
            await Task.WhenAll(deleteTasks);
            var updateTasks = new List<Task<CompleteWay>>();
            foreach (var highwaysToUpdate in changes.Modify
                .Concat(changes.Create)
                .OfType<Way>()
                .Where(w => w.Tags != null && w.Tags.ContainsKey("highway")))
            {
                var task = _osmGateway.GetCompleteWay(highwaysToUpdate.Id.ToString());
                updateTasks.Add(task);
            }
            var updatedWays = await Task.WhenAll(updateTasks);
            var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(updatedWays.ToList());
            await _elasticSearchGateway.UpdateHighwaysData(geoJsonHighways);
        }

        private async Task UpdatePointsOfInterest(OsmChange changes)
        {
            var deleteTasks = new List<Task>();
            var relevantTagsDictionary = _tagsHelper.GetAllTags();
            foreach (var poiToRemove in changes.Delete)
            {
                var task = _elasticSearchGateway.DeleteOsmPointOfInterestById(poiToRemove.Type.ToString().ToLower() + "_" + poiToRemove.Id);
                deleteTasks.Add(task);
            }
            await Task.WhenAll(deleteTasks);
            var updateTasks = new List<Task<ICompleteOsmGeo>>();
            foreach (var poiToUpdate in changes.Modify
                .Concat(changes.Create)
                .Where(o => IsRelevantPointOfInterest(o, relevantTagsDictionary)))
            {
                var task = _osmGateway.GetElement(poiToUpdate.Id.ToString(), poiToUpdate.Type.ToString().ToLower());
                updateTasks.Add(task);
            }
            var allElemets = await Task.WhenAll(updateTasks);
            var osmNamesDictionary = allElemets.GroupBy(e => e.Tags.GetName()).ToDictionary(g => g.Key, g => g.ToList());
            var features = _osmGeoJsonPreprocessorExecutor.Preprocess(osmNamesDictionary);

            foreach (var poiToUpdate in changes.Modify
                .Where(o => IsRelevantPointOfInterest(o, relevantTagsDictionary)))
            {
                var featureFromDb = await _elasticSearchGateway.GetPointOfInterestById(poiToUpdate.Type.ToString().ToLower() + "_" + poiToUpdate.Id, Sources.OSM);
                if (featureFromDb == null)
                {
                    continue;
                }
                var featureToUpdate = features.FirstOrDefault(f =>
                    f.Attributes[FeatureAttributes.ID].Equals(featureFromDb.Attributes[FeatureAttributes.ID]));
                if (featureToUpdate == null)
                {
                    continue;
                }
                foreach (var attributeKey in featureFromDb.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.POI_PREFIX)))
                {
                    featureToUpdate.Attributes.AddOrUpdate(attributeKey, featureFromDb.Attributes[attributeKey]);   
                }
            }
            await _elasticSearchGateway.UpdatePointsOfInterestData(features);
        }

        private bool IsRelevantPointOfInterest(OsmGeo osm, List<KeyValuePair<string, string>> relevantTagsDictionary)
        {
            return osm.Tags != null && (osm.Tags.GetName() != string.Empty || osm.Tags.HasAny(relevantTagsDictionary));
        }

        /// <inheritdoc />
        public async Task Rebuild(UpdateRequest request)
        {
            var rebuildRoutingTask = Task.CompletedTask;
            if (request.Routing)
            {
                rebuildRoutingTask = RebuildRouting();
            } 
            if (request.Highways)
            {
                await RebuildHighways();
            }
            if (request.PointsOfInterest)
            {
                await RebuildPointsOfInterest();
            }
            await rebuildRoutingTask;
        }

        private async Task RebuildRouting()
        {
            _logger.LogInformation("Starting rebuilding routing database.");
            using (var stream = _latestFileFetcherExecutor.Get())
            using (var memoryStream = new MemoryStream())
            {
                stream.CopyTo(memoryStream);
                await _graphHopperGateway.Rebuild(memoryStream);
            }
            _logger.LogInformation("Finished rebuilding POIs database.");
        }


        private async Task RebuildPointsOfInterest()
        {
            _logger.LogInformation("Starting rebuilding POIs database.");
            var fetchTasks = _pointsOfInterestAdapterFactory.GetAll().Select(a => a.GetPointsForIndexing()).ToArray();
            var features = (await Task.WhenAll(fetchTasks)).SelectMany(v => v).ToList();
            features = _featuresMergeExecutor.Merge(features);
            await _elasticSearchGateway.UpdatePointsOfInterestZeroDownTime(features);
            _logger.LogInformation("Finished rebuilding POIs database.");
        }

        private async Task RebuildHighways()
        {
            _logger.LogInformation("Starting rebuilding highways database.");
            using (var stream = _latestFileFetcherExecutor.Get())
            {
                var osmHighways = await _osmRepository.GetAllHighways(stream);
                var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
                await _elasticSearchGateway.UpdateHighwaysZeroDownTime(geoJsonHighways);
            }

            _logger.LogInformation("Finished rebuilding highways database.");
        }
    }
}
