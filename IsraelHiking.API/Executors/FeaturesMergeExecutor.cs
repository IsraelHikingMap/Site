using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class FeaturesMergeExecutor : IFeaturesMergeExecutor
    {
        private readonly ILogger<FeaturesMergeExecutor> _reportLogger;
        private readonly ILogger _logger;

        /// <summary>
        /// Class's constructor
        /// </summary>
        /// <param name="reportLogger"></param>
        /// <param name="logger"></param>
        public FeaturesMergeExecutor(ILogger<FeaturesMergeExecutor> reportLogger, ILogger logger)
        {
            _reportLogger = reportLogger;
            _logger = logger;
        }

        /// <inheritdoc />
        public List<Feature> Merge(List<Feature> features)
        {
            features = MergeWikipediaToOsmByWikipediaTags(features);
            features = MergeByTitle(features);
            return features;
        }

        private List<Feature> MergeByTitle(List<Feature> features)
        {
            _logger.LogInformation("Starting features merging.");

            var featureIdsToRemove = new List<string>();
            var mergingDictionary = new Dictionary<string, List<Feature>>();
            var osmFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].ToString() == Sources.OSM)
                .OrderBy(f => f.Attributes[FeatureAttributes.ID])
                .ToArray();
            var nonOsmFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].ToString() != Sources.OSM);
            var orderedFeatures = osmFeatures.Concat(nonOsmFeatures).ToArray();
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
                        WriteToReport(featureToMergeTo, feature);
                        var titlesToAddToDictionary = featureToMergeTo.GetTitles().Except(titlesBeforeMerge);
                        foreach (var titleToAdd in titlesToAddToDictionary)
                        {
                            AddToDictionaryWithList(mergingDictionary, titleToAdd, featureToMergeTo);
                        }
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
            SimplifyGeometriesCollection(results);
            _logger.LogInformation($"Finished feature merging: {results.Count}");
            return results;
        }

        private void SimplifyGeometriesCollection(List<Feature> results)
        {
            foreach (var feature in results)
            {
                if (!(feature.Geometry is GeometryCollection geometryCollection))
                {
                    continue;
                }

                if (geometryCollection.Geometries.All(g => g is LineString))
                {
                    feature.Geometry = new MultiLineString(geometryCollection.Geometries.Cast<ILineString>().ToArray());
                    continue;
                }
                var nonPointGeometry = geometryCollection.Geometries.FirstOrDefault(g => !(g is Point));
                feature.Geometry = nonPointGeometry ?? geometryCollection.First();
            }
        }

        private void WriteToReport(Feature featureToMergeTo, Feature feature)
        {
            if (!feature.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                !featureToMergeTo.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            {
                _reportLogger.LogInformation("There's probably a need to add an OSM point here: ");
            }
            var site = GetWebsite(feature);
            var from = "<a href='" + site + "' target='_blank'>From: " + feature.Attributes[FeatureAttributes.ID] + "</a>";
            site = GetWebsite(featureToMergeTo);
            var to = "<a href='" + site + "' target='_blank'>To: " + featureToMergeTo.Attributes[FeatureAttributes.ID] + "</a><br/>";
            _reportLogger.LogInformation(from + " " + to);
        }

        private string GetWebsite(Feature feature)
        {
            if (feature.Attributes.Exists(FeatureAttributes.WEBSITE))
            {
                return feature.Attributes[FeatureAttributes.WEBSITE].ToString();
            }

            var id = feature.Attributes[FeatureAttributes.ID].ToString();
            if (id.Split("_").Length == 2)
            {
                return "https://www.openstreetmap.org/" + id.Split("_")[0] + "/" + id.Split("_")[1];
            }

            return string.Empty;
        }

        private void MergeFeatures(IFeature featureToMergeTo, IFeature feature)
        {
            if (featureToMergeTo.Geometry is GeometryCollection geometryCollection)
            {
                featureToMergeTo.Geometry = new GeometryCollection(geometryCollection.Geometries.Concat(new [] { feature.Geometry}).ToArray());
            }
            else
            {
                featureToMergeTo.Geometry = new GeometryCollection(new[] { featureToMergeTo.Geometry, feature.Geometry });
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

            if (!featureToMergeTo.Attributes[FeatureAttributes.POI_SOURCE]
                    .Equals(feature.Attributes[FeatureAttributes.POI_SOURCE]) ||
                !feature.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            {
                // do not merge OSM elements to each other since they won't exists in the database for fetching
                featureToMergeTo.AddIdToCombinedPoi(feature);
            }

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
            bool geometryContains;
            if (target.Geometry is GeometryCollection geometryCollection)
            {
                geometryContains = geometryCollection.Geometries.Any(g => source.Geometry.Contains(g));
            }
            else
            {
                geometryContains = source.Geometry.Contains(target.Geometry);
            }
            if (!geometryContains && source.Geometry.Distance(target.Geometry) > 0.001)
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

        private List<Feature> MergeWikipediaToOsmByWikipediaTags(List<Feature> features)
        {
            _logger.LogInformation("Starting joining wikipedia markers. Initial list size: " + features.Count);
            var featureIdsToRemove = new List<string>();
            var wikiFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.WIKIPEDIA)).ToList();
            var osmWikiFeatures = features.Where(f =>
                    f.Attributes.GetNames().Any(n => n.StartsWith(FeatureAttributes.WIKIPEDIA)) &&
                    f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
                .ToList();
            foreach (var osmWikiFeature in osmWikiFeatures)
            {
                var wikiAttributeKeys = osmWikiFeature.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WIKIPEDIA));
                foreach (var key in wikiAttributeKeys)
                {
                    var title = osmWikiFeature.Attributes[key].ToString();
                    var wikiFeatureToRemove = wikiFeatures.FirstOrDefault(f => f.Attributes.Has(key, title));
                    if (wikiFeatureToRemove == null)
                    {
                        continue;
                    }
                    wikiFeatures.Remove(wikiFeatureToRemove);
                    featureIdsToRemove.Add(wikiFeatureToRemove.Attributes[FeatureAttributes.ID].ToString());
                    osmWikiFeature.AddIdToCombinedPoi(wikiFeatureToRemove);
                }
            }
            var results = features.Where(f => featureIdsToRemove.Contains(f.Attributes[FeatureAttributes.ID].ToString()) == false).ToList();
            _logger.LogInformation("Finished joining wikipedia markers. Final list size: " + results.Count);
            return results;
        }
    }
}
