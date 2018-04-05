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
using NetTopologySuite.Geometries;
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
            // HM TODO: update only added/removed tags.
            // HM TODO: on create do not do any thing
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
                JoinWikipediaAndOsmPoint(features);
                features = MergeByTitle(features);
                await _elasticSearchGateway.UpdatePointsOfInterestZeroDownTime(features);
                _logger.LogInformation("Finished rebuilding POIs database.");
            }
        }

        private List<Feature> MergeByTitle(List<Feature> features)
        {
            _logger.LogInformation("Starting features merging.");

            var featureIdsToRemove = new List<string>();
            var mergingDictionary = new Dictionary<string, List<Feature>>();
            var osmFeaturesWithIcon = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].ToString() == Sources.OSM &&
                                                          !string.IsNullOrWhiteSpace(f.Attributes[FeatureAttributes.ICON].ToString()))
                .OrderBy(f => f.Attributes[FeatureAttributes.ID])
                .ToArray();
            var nonOsmFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].ToString() != Sources.OSM);
            var orderedFeatures = osmFeaturesWithIcon.Concat(nonOsmFeatures).ToArray();
            _logger.LogInformation($"Total features to merge: {orderedFeatures.Length}");
            foreach (var feature in orderedFeatures)
            {
                var titles = feature.GetTitles();
                bool wasMerged = false;
                foreach (var title in titles)
                {
                    if (!mergingDictionary.ContainsKey(title))
                    {
                        continue;
                    }
                    foreach (var featureToMergeTo in mergingDictionary[title])
                    {
                        if (!CanMerge(featureToMergeTo, feature))
                        {
                            continue;
                        }
                        wasMerged = true;
                        featureIdsToRemove.Add(feature.Attributes[FeatureAttributes.ID].ToString());
                        var titlesBeforeMerge = featureToMergeTo.GetTitles();
                        MergeFeatures(featureToMergeTo, feature);

                        var titlesToAddToDictionary = featureToMergeTo.GetTitles().Except(titlesBeforeMerge);
                        foreach (var titleToAdd in titlesToAddToDictionary)
                        {
                            AddToDictionaryWithList(mergingDictionary, titleToAdd, featureToMergeTo);
                        }
                        featureToMergeTo.AddIdToCombinedPoi(feature.Attributes[FeatureAttributes.ID].ToString(), feature.Attributes[FeatureAttributes.POI_SOURCE].ToString());
                    }
                }
                if (wasMerged)
                {
                    continue;
                }
                foreach (var title in titles)
                {
                    AddToDictionaryWithList(mergingDictionary, title, feature);
                }
            }

            featureIdsToRemove = featureIdsToRemove.Distinct().ToList();
            var results = features.Where(f => featureIdsToRemove.Contains(f.Attributes[FeatureAttributes.ID].ToString()) == false).ToList();
            _logger.LogInformation($"Finished feature merging: {results.Count}");
            return results;
        }

        private void MergeFeatures(IFeature featureToMergeTo, IFeature feature)
        {
            if (featureToMergeTo.Geometry is Point && !(feature.Geometry is Point))
            {
                featureToMergeTo.Geometry = feature.Geometry;
            }

            if (featureToMergeTo.Attributes[FeatureAttributes.POI_CATEGORY].Equals(Categories.NONE))
            {
                featureToMergeTo.Attributes[FeatureAttributes.POI_CATEGORY] =
                    feature.Attributes[FeatureAttributes.POI_CATEGORY];
            }

            if (double.Parse(featureToMergeTo.Attributes[FeatureAttributes.SEARCH_FACTOR].ToString()) <
                double.Parse(feature.Attributes[FeatureAttributes.SEARCH_FACTOR].ToString()))
            {
                featureToMergeTo.Attributes[FeatureAttributes.SEARCH_FACTOR] =
                    feature.Attributes[FeatureAttributes.SEARCH_FACTOR];
            }

            if (string.IsNullOrWhiteSpace(featureToMergeTo.Attributes[FeatureAttributes.ICON].ToString()))
            {
                featureToMergeTo.Attributes[FeatureAttributes.ICON] =
                    feature.Attributes[FeatureAttributes.ICON];
                featureToMergeTo.Attributes[FeatureAttributes.ICON_COLOR] =
                    feature.Attributes[FeatureAttributes.ICON_COLOR];
            }

            // adding names of merged feature
            featureToMergeTo.MergeTitles(feature);
        }

        private void AddToDictionaryWithList(Dictionary<string, List<Feature>> dictionary, string title, Feature feature)
        {
            if (dictionary.ContainsKey(title))
            {
                dictionary[title].Add(feature);
            }
            else
            {
                dictionary[title] = new List<Feature> { feature };
            }
        }

        private bool CanMerge(Feature target, Feature source)
        {
            if (!source.Geometry.Contains(target.Geometry) &&
                source.Geometry.Distance(target.Geometry) > 0.001)
            {
                // too far away to be merged
                return false;
            }
            // points have the same title and are close enough
            if (source.Attributes[FeatureAttributes.ICON].Equals(target.Attributes[FeatureAttributes.ICON]))
            {
                return true;
            }
            // different icon
            if (!source.Attributes[FeatureAttributes.POI_SOURCE].Equals(target.Attributes[FeatureAttributes.POI_SOURCE]))
            {
                return true;
            }
            // different icon but same source
            return false;
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
