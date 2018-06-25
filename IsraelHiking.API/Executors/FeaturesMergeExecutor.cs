using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This comparer handles the order of which features are merged.
    /// Features that are ordered first will be the target of the merge 
    /// while features that are ordered last will be the source of the merge.
    /// </summary>
    internal class FeatureComparer : IComparer<Feature>
    {
        public int Compare(Feature x, Feature y)
        {
            if (x.Geometry is Point && y.Geometry is Point)
            {
                return 0;
            }
            var results = x.Geometry.Area.CompareTo(y.Geometry.Area);
            if (results != 0)
            {
                return results;
            }
    
            if (x.Geometry is Point)
            {
                return -1;
            }
            return 1;
        }
    }
    
    /// <inheritdoc />
    public class FeaturesMergeExecutor : IFeaturesMergeExecutor
    {
        private readonly ConfigurationData _options;
        private readonly ILogger<FeaturesMergeExecutor> _reportLogger;
        private readonly ILogger _logger;

        /// <summary>
        /// Class's constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="reportLogger"></param>
        /// <param name="logger"></param>
        public FeaturesMergeExecutor(IOptions<ConfigurationData> options,
            ILogger<FeaturesMergeExecutor> reportLogger, 
            ILogger logger)
        {
            _options = options.Value;
            _reportLogger = reportLogger;
            _logger = logger;
        }

        /// <inheritdoc />
        public List<Feature> Merge(List<Feature> features)
        {
            features = MergeWikipediaToOsmByWikipediaTags(features);
            features = MergeOffRoadKklRoutesToOsm(features);
            features = MergeByTitle(features);
            return features;
        }

        private List<Feature> MergeByTitle(List<Feature> features)
        {
            _logger.LogInformation("Starting features merging by title.");

            var featureIdsToRemove = new List<string>();
            var mergingDictionary = new Dictionary<string, List<Feature>>();
            var osmFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
                .OrderBy(f => f, new FeatureComparer())
                .ToArray();
            _logger.LogInformation($"Sorted features by importance: {osmFeatures.Length}");
            var nonOsmFeatures = features.Where(f => !f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM));
            var orderedFeatures = osmFeatures.Concat(nonOsmFeatures).ToArray();
            for (var featureIndex = 0; featureIndex < orderedFeatures.Length; featureIndex++)
            {
                var feature = orderedFeatures[featureIndex];
                if (featureIndex % 10000 == 0)
                {
                    _logger.LogInformation($"Processed {featureIndex} of {features.Count}");
                }
                var titles = feature.GetTitles();
                var needsToBeMergedTo = new Dictionary<string, List<Feature>>();
                foreach (var title in titles)
                {
                    if (!mergingDictionary.ContainsKey(title))
                    {
                        continue;
                    }

                    var featuresToMergeTo = mergingDictionary[title].Where(f => CanMerge(f, feature)).ToList();
                    if (featuresToMergeTo.Any())
                    {
                        needsToBeMergedTo[title] = featuresToMergeTo;
                    }
                }

                if (!needsToBeMergedTo.Keys.Any())
                {
                    foreach (var title in titles)
                    {
                        AddToDictionaryWithList(mergingDictionary, title, feature);
                    }
                }
                else
                {
                    var featureToMergeTo = needsToBeMergedTo.Values.First().First();
                    HandleMergingDictionary(mergingDictionary, featureIdsToRemove, featureToMergeTo, feature);
                    var whereMerged = new List<Feature> { featureToMergeTo, feature };
                    foreach (var pair in needsToBeMergedTo)
                    {
                        foreach (var featureToMerge in pair.Value)
                        {
                            if (whereMerged.Contains(featureToMerge))
                            {
                                continue;
                            }
                            whereMerged.Add(featureToMerge);
                            HandleMergingDictionary(mergingDictionary, featureIdsToRemove, featureToMergeTo, featureToMerge);
                            mergingDictionary[pair.Key].Remove(featureToMerge);
                        }
                    }
                }
            }

            featureIdsToRemove = featureIdsToRemove.Distinct().ToList();
            var results = features.Where(f => featureIdsToRemove.Contains(f.Attributes[FeatureAttributes.ID].ToString()) == false).ToList();
            SimplifyGeometriesCollection(results);
            _logger.LogInformation($"Finished feature merging by title. merged features: {featureIdsToRemove.Count}");
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
                
                if (geometryCollection.Geometries.All(g => g is LineString || g is MultiLineString))
                {
                    var lines = geometryCollection.Geometries
                        .OfType<MultiLineString>()
                        .SelectMany(mls => mls.Geometries.OfType<LineString>())
                        .Concat(geometryCollection.Geometries.OfType<LineString>())
                        .Cast<ILineString>()
                        .ToArray();
                    feature.Geometry = new MultiLineString(lines);
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
            var from =
                $"<a href='{site}' target='_blank'>From {feature.GetTitles().First()}: {feature.Attributes[FeatureAttributes.ID]}</a>";
            site = GetWebsite(featureToMergeTo);
            var to = 
                $"<a href='{site}' target='_blank'>To {featureToMergeTo.GetTitles().First()}: {featureToMergeTo.Attributes[FeatureAttributes.ID]}</a><br/>";
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
                return "https://www.openstreetmap.org/" + feature.GetOsmType() + "/" + feature.GetOsmId();
            }

            return string.Empty;
        }

        private void HandleMergingDictionary(Dictionary<string, List<Feature>> mergingDictionary, List<string> featureIdsToRemove, Feature featureToMergeTo, Feature feature)
        {
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

        private void MergeFeatures(IFeature featureToMergeTo, IFeature feature)
        {
            if (featureToMergeTo.Attributes[FeatureAttributes.ID].Equals(feature.Attributes[FeatureAttributes.ID]))
            {
                return;
            }
            if (featureToMergeTo.Geometry is GeometryCollection geometryCollection)
            {
                if (feature.Geometry is GeometryCollection geometryCollectionSource)
                {
                    featureToMergeTo.Geometry = new GeometryCollection(geometryCollection.Geometries.Concat(geometryCollectionSource.Geometries).ToArray());
                }
                else
                {
                    featureToMergeTo.Geometry = new GeometryCollection(geometryCollection.Geometries.Concat(new[] { feature.Geometry }).ToArray());
                }
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
            featureToMergeTo.MergeCombinedPoiIds(feature);
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
            if (target.Attributes[FeatureAttributes.ID].Equals(source.Attributes[FeatureAttributes.ID]))
            {
                return false;
            }
            bool geometryContains;
            if (target.Geometry is GeometryCollection geometryCollection)
            {
                geometryContains = geometryCollection.Geometries.Any(g => source.Geometry.Contains(g));
            }
            else
            {
                geometryContains = source.Geometry.Contains(target.Geometry);
            }
            if (!geometryContains && source.Geometry.Distance(target.Geometry) > _options.MergePointsOfInterestThreshold)
            {
                // too far away to be merged
                return false;
            }
            // points have the same title and are close enough
            if (source.Attributes[FeatureAttributes.ICON].Equals(target.Attributes[FeatureAttributes.ICON]))
            {
                return true;
            }

            if (target.Attributes[FeatureAttributes.ICON].Equals("icon-bus-stop") &&
                target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                !source.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            {
                // do not merge non-osm info into bus stops
                return false;
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
            WriteToBothLoggers("Starting joining Wikipedia markers.");
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
                    if (wikiFeatureToRemove != null)
                    {
                        WriteToReport(osmWikiFeature, wikiFeatureToRemove);
                        wikiFeatures.Remove(wikiFeatureToRemove);
                        featureIdsToRemove.Add(wikiFeatureToRemove.Attributes[FeatureAttributes.ID].ToString());
                        osmWikiFeature.AddIdToCombinedPoi(wikiFeatureToRemove);
                    }
                }
            }
            WriteToBothLoggers($"Finished joining Wikipedia markers. Merged features: {featureIdsToRemove.Count}");
            return features.Where(f => featureIdsToRemove.Contains(f.Attributes[FeatureAttributes.ID].ToString()) == false).ToList();
        }

        private List<Feature> MergeOffRoadKklRoutesToOsm(List<Feature> features)
        {
            var featureIdsToRemove = new List<string>();
            var osmKklRoutes = features.Where(f => f.Attributes.Has("operator", "kkl") && f.Attributes.Has("route", "mtb")).ToArray();
            var offRoadRoutes = features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OFFROAD)).ToList();
            WriteToBothLoggers("Starting joining off-road-kkl routes.");
            foreach (var osmKklRoute in osmKklRoutes)
            {
                var titles = osmKklRoute.GetTitles();
                var offRoadRoutesToMerge = offRoadRoutes.Where(r =>
                    titles.Any(t => t.Contains(r.Attributes[FeatureAttributes.NAME].ToString()) ||
                                    r.Attributes[FeatureAttributes.NAME].ToString().Contains(t)) &&
                    r.Geometry.Distance(osmKklRoute.Geometry) < _options.MergePointsOfInterestThreshold).ToArray();
                foreach (var offRoadRoute in offRoadRoutesToMerge)
                {
                    WriteToReport(osmKklRoute, offRoadRoute);
                    offRoadRoutes.Remove(offRoadRoute);
                    osmKklRoute.AddIdToCombinedPoi(offRoadRoute);
                    featureIdsToRemove.Add(offRoadRoute.Attributes[FeatureAttributes.ID].ToString());
                }
            }
            WriteToBothLoggers($"Finished joining off-road-kkl routes. Merged features: {featureIdsToRemove.Count}");
            return features.Where(f => featureIdsToRemove.Contains(f.Attributes[FeatureAttributes.ID].ToString()) == false).ToList();
        }

        private void WriteToBothLoggers(string message)
        {
            _logger.LogInformation(message);
            _reportLogger.LogInformation(message + "<br/>");
        }
    }
}

