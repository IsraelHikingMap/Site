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
    public class OsmElasticSearchUpdaterService : IOsmElasticSearchUpdaterService
    {
        private readonly IOsmGateway _osmGateway;
        private readonly IElasticSearchGateway _elasticSearchGateway;
        private readonly IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;
        private readonly ITagsHelper _tagsHelper;
        private readonly IOsmRepository _osmRepository;
        private readonly IEnumerable<IPointsOfInterestAdapter> _adapters;
        private readonly IFeaturesMergeExecutor _featuresMergeExecutor;
        private readonly ILogger _logger;

        /// <summary>
        /// Service's constructor
        /// </summary>
        /// <param name="factory"></param>
        /// <param name="elasticSearchGateway"></param>
        /// <param name="osmGeoJsonPreprocessorExecutor"></param>
        /// <param name="tagsHelper"></param>
        /// <param name="osmRepository"></param>
        /// <param name="adapters"></param>
        /// <param name="featuresMergeExecutor"></param>
        /// <param name="logger"></param>
        public OsmElasticSearchUpdaterService(IHttpGatewayFactory factory, 
            IElasticSearchGateway elasticSearchGateway, 
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor, 
            ITagsHelper tagsHelper, IOsmRepository osmRepository, 
            IEnumerable<IPointsOfInterestAdapter> adapters,
            IFeaturesMergeExecutor featuresMergeExecutor,
            ILogger logger)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _tagsHelper = tagsHelper;
            _osmRepository = osmRepository;
            _adapters = adapters;
            _logger = logger;
            _featuresMergeExecutor = featuresMergeExecutor;
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
        public async Task Rebuild(UpdateRequest request, Stream stream)
        {
            if (request.Highways)
            {
                _logger.LogInformation("Starting rebuilding highways database.");
                var osmHighways = await _osmRepository.GetAllHighways(stream);
                var geoJsonHighways = _osmGeoJsonPreprocessorExecutor.Preprocess(osmHighways);
                await _elasticSearchGateway.UpdateHighwaysZeroDownTime(geoJsonHighways);
                _logger.LogInformation("Finished rebuilding highways database.");
            }
            if (request.PointsOfInterest)
            {
                _logger.LogInformation("Starting rebuilding POIs database.");
                var fetchTasks = _adapters.Select(a => a.GetPointsForIndexing(stream)).ToArray();
                var features = (await Task.WhenAll(fetchTasks)).SelectMany(v => v).ToList();
                features = _featuresMergeExecutor.Merge(features);
                await _elasticSearchGateway.UpdatePointsOfInterestZeroDownTime(features);
                _logger.LogInformation("Finished rebuilding POIs database.");
            }
        }
    }
}
