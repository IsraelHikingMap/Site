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
using NetTopologySuite.Features;
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
        /// <param name="logger"></param>
        public OsmElasticSearchUpdaterService(IHttpGatewayFactory factory, 
            IElasticSearchGateway elasticSearchGateway, 
            IOsmGeoJsonPreprocessorExecutor osmGeoJsonPreprocessorExecutor, 
            ITagsHelper tagsHelper, IOsmRepository osmRepository, 
            IEnumerable<IPointsOfInterestAdapter> adapters,
            ILogger logger)
        {
            _elasticSearchGateway = elasticSearchGateway;
            _osmGeoJsonPreprocessorExecutor = osmGeoJsonPreprocessorExecutor;
            _tagsHelper = tagsHelper;
            _osmRepository = osmRepository;
            _adapters = adapters;
            _logger = logger;
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
                var task = _elasticSearchGateway.DeleteOsmPointOfInterestById(poiToRemove.Id.ToString(), poiToRemove.Type.ToString().ToLower());
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
            var containers = new List<Feature>();
            foreach (var feature in features)
            {
                var currentContainers = await _elasticSearchGateway.GetContainers(feature.Geometry.Coordinate);
                currentContainers = currentContainers.Where(cc => cc.IsValidContainer() &&
                                                                  containers.FirstOrDefault(c =>
                                                                      c.Attributes[FeatureAttributes.ID]
                                                                          .Equals(cc.Attributes[FeatureAttributes.ID])
                                                                  ) == null)
                    .OrderBy(c => c.Geometry.Area)
                    .ToList();
                containers.AddRange(currentContainers);
            }
            features = _osmGeoJsonPreprocessorExecutor.AddAddress(features, containers);
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
                var fetchTask = _adapters.Select(a => a.GetPointsForIndexing(stream)).ToArray();
                var features = (await Task.WhenAll(fetchTask)).SelectMany(v => v).ToList();
                JoinWikipediaAndOsmPoint(features);
                await _elasticSearchGateway.UpdatePointsOfInterestZeroDownTime(features);
                _logger.LogInformation("Finished rebuilding POIs database.");
            }
        }

        private void JoinWikipediaAndOsmPoint(List<Feature> features)
        {
            _logger.LogInformation("Starting joining wikipedia markers. Initial list size: " + features.Count);
            var wikiFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].ToString() == Sources.WIKIPEDIA).ToList();
            var osmWikiFeatures = features.Where(f =>
                    f.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.WIKIPEDIA)) &&
                    f.Attributes[FeatureAttributes.POI_SOURCE].ToString() == Sources.OSM)
                .ToList();
            foreach (var osmWikiFeature in osmWikiFeatures)
            {
                var wikiAttributeKeys = osmWikiFeature.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WIKIPEDIA));
                foreach (var key in wikiAttributeKeys)
                {
                    var title = osmWikiFeature.Attributes[key].ToString();
                    var wikiFeatureToRemove = wikiFeatures.FirstOrDefault(f => f.Attributes.Has(key, title));
                    if (wikiFeatureToRemove != null)
                    {
                        wikiFeatures.Remove(wikiFeatureToRemove);
                        features.Remove(wikiFeatureToRemove);
                    }
                }
            }
            _logger.LogInformation("Finished joining wikipedia markers. Final list size: " + features.Count);
        }
    }
}
