using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Linq;

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
        private const string PLACE = "place";

        private readonly ConfigurationData _options;
        private readonly ILogger<FeaturesMergeExecutor> _reportLogger;
        private readonly ILogger _logger;
        private readonly GeometryFactory _geometryFactory;

        /// <summary>
        /// Class's constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="geometryFactory"></param>
        /// <param name="reportLogger"></param>
        /// <param name="logger"></param>
        public FeaturesMergeExecutor(IOptions<ConfigurationData> options,
            GeometryFactory geometryFactory,
            ILogger<FeaturesMergeExecutor> reportLogger,
            ILogger logger)
        {
            _options = options.Value;
            _reportLogger = reportLogger;
            _logger = logger;
            _geometryFactory = geometryFactory;
        }

        /// <inheritdoc />
        public List<Feature> Merge(List<Feature> features)
        {
            AddAlternativeTitleToNatureReserves(features);
            features = MergeWikipediaToOsmByWikipediaTags(features);
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
            osmFeatures = MergePlaceNodes(osmFeatures, featureIdsToRemove);
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
            _logger.LogInformation($"Processed {features.Count} of {features.Count}");
            featureIdsToRemove = featureIdsToRemove.Distinct().ToList();
            var results = features.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
            SimplifyGeometriesCollection(results);
            _logger.LogInformation($"Finished feature merging by title. merged features: {featureIdsToRemove.Count}");
            return results;
        }

        private Feature[] MergePlaceNodes(Feature[] features, List<string> featureIdsToRemove)
        {
            var containers = features.Where(f => f.IsValidContainer()).OrderBy(f => f.Geometry.Area).ToList();
            WriteToBothLoggers($"Starting places merging: {features.Length}, places: {containers.Count}");
            foreach (var feature in features)
            {
                var placesToRemove = UpdatePlacesGeometry(feature, containers);
                if (placesToRemove.Any())
                {
                    // database places are nodes that should not be removed.
                    var ids = placesToRemove.Select(p => p.GetId()).ToList();
                    featureIdsToRemove.AddRange(ids);
                }
            }

            WriteToBothLoggers($"Finished places merging. Merged places: {featureIdsToRemove.Count}");
            return features.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToArray();
        }

        private List<Feature> UpdatePlacesGeometry(Feature feature, List<Feature> places)
        {
            if (feature.Geometry is Point == false ||
                feature.Attributes.Exists(PLACE) == false ||
                feature.Attributes.Exists(FeatureAttributes.NAME) == false)
            {
                return new List<Feature>();
            }
            var placeContainers = places.Where(c => IsPlaceContainer(c, feature))
                .OrderBy(f => f.Geometry.Area)
                .ToList();

            if (!placeContainers.Any())
            {
                return placeContainers;
            }
            // setting the geometry of the area to the point to facilitate for updating the place point while showing the area
            var container = placeContainers.First();
            feature.Geometry = container.Geometry;
            feature.Attributes[FeatureAttributes.POI_CONTAINER] = container.Attributes[FeatureAttributes.POI_CONTAINER];
            WriteToReport(feature, container);
            return placeContainers;
        }

        private bool IsPlaceContainer(IFeature container, IFeature feature)
        {
            try
            {
                var containsOrClose = false;
                if (feature.Geometry is Point)
                {
                    containsOrClose = container.Geometry.Contains(feature.Geometry) ||
                        container.Geometry.Distance(feature.Geometry) <= _options.MergePointsOfInterestThreshold;
                }
                else
                {
                    containsOrClose = container.Geometry.Contains(feature.Geometry);
                }
                return container.Attributes.Exists(FeatureAttributes.NAME) &&
                       container.Attributes[FeatureAttributes.NAME].Equals(feature.Attributes[FeatureAttributes.NAME]) &&
                       containsOrClose &&
                       !container.Geometry.EqualsTopologically(feature.Geometry) &&
                       !container.GetId().Equals(feature.GetId());
            }
            catch (Exception ex)
            {
                _logger.LogError($"Problem with places check for container: {container} name: {container.Attributes[FeatureAttributes.NAME]} feature {feature} name: {feature.Attributes[FeatureAttributes.NAME]}\n{ex.Message}");
            }
            return false;
        }

        private void SimplifyGeometriesCollection(List<Feature> results)
        {
            foreach (var feature in results)
            {
                if (!(feature.Geometry is GeometryCollection geometryCollection))
                {
                    continue;
                }
                if (geometryCollection.Geometries.All(g => g is Point || g is MultiPoint))
                {
                    var points = geometryCollection.Geometries
                        .OfType<MultiPoint>()
                        .SelectMany(mls => mls.Geometries.OfType<Point>())
                        .Concat(geometryCollection.Geometries.OfType<Point>())
                        .ToArray();
                    feature.Geometry = _geometryFactory.CreateMultiPoint(points);
                    continue;
                }
                var nonPointGeometries = geometryCollection.Geometries.Where(g => !(g is Point));
                if (nonPointGeometries.Count() == 1)
                {
                    feature.Geometry = nonPointGeometries.First();
                    continue;
                }
                if (nonPointGeometries.All(g => g is LineString || g is MultiLineString))
                {
                    var lines = nonPointGeometries
                        .OfType<MultiLineString>()
                        .SelectMany(mls => mls.Geometries.OfType<LineString>())
                        .Concat(nonPointGeometries.OfType<LineString>())
                        .ToArray();
                    feature.Geometry = _geometryFactory.CreateMultiLineString(lines);
                    continue;
                }
                if (nonPointGeometries.All(g => g is Polygon || g is MultiPolygon))
                {
                    var polygons = nonPointGeometries
                        .OfType<MultiPolygon>()
                        .SelectMany(mls => mls.Geometries.OfType<Polygon>())
                        .Concat(nonPointGeometries.OfType<Polygon>())
                        .ToArray();
                    feature.Geometry = _geometryFactory.CreateMultiPolygon(polygons);
                    if (!feature.Geometry.IsValid)
                    {
                        feature.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, false);
                        _reportLogger.LogWarning("There was a problem merging the following feature " + feature.GetTitle(Languages.HEBREW) + " (" + feature.GetId() + ") ");
                    }
                    continue;
                }
                _reportLogger.LogWarning("The following merge created a weird geometry: " + feature.GetTitle(Languages.HEBREW) + " (" + feature.GetId() + ") " + string.Join(", ", geometryCollection.Geometries.Select(g => g.GeometryType)));
                feature.Geometry = nonPointGeometries.FirstOrDefault();
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
                $"<a href='{site}' target='_blank'>From {feature.GetTitles().First()}: {feature.GetId()}</a>";
            site = GetWebsite(featureToMergeTo);
            var to =
                $"<a href='{site}' target='_blank'>To {featureToMergeTo.GetTitles().First()}: {featureToMergeTo.GetId()}</a><br/>";
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
            featureIdsToRemove.Add(feature.GetId());
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
            if (featureToMergeTo.GetId().Equals(feature.GetId()))
            {
                return;
            }

            if (featureToMergeTo.Attributes[FeatureAttributes.POI_CATEGORY].Equals(Categories.NONE))
            {
                featureToMergeTo.Attributes[FeatureAttributes.POI_CATEGORY] =
                    feature.Attributes[FeatureAttributes.POI_CATEGORY];
            }

            if (double.Parse(featureToMergeTo.Attributes[FeatureAttributes.POI_SEARCH_FACTOR].ToString()) <
                double.Parse(feature.Attributes[FeatureAttributes.POI_SEARCH_FACTOR].ToString()))
            {
                featureToMergeTo.Attributes[FeatureAttributes.POI_SEARCH_FACTOR] =
                    feature.Attributes[FeatureAttributes.POI_SEARCH_FACTOR];
            }

            if (string.IsNullOrWhiteSpace(featureToMergeTo.Attributes[FeatureAttributes.POI_ICON].ToString()))
            {
                featureToMergeTo.Attributes[FeatureAttributes.POI_ICON] =
                    feature.Attributes[FeatureAttributes.POI_ICON];
                featureToMergeTo.Attributes[FeatureAttributes.POI_ICON_COLOR] =
                    feature.Attributes[FeatureAttributes.POI_ICON_COLOR];
            }

            // adding names of merged feature
            MergeGeometry(featureToMergeTo, feature);
            MergeTitles(featureToMergeTo, feature);
            MergeDescriptionAndAuthor(featureToMergeTo, feature);
            MergeWebsite(featureToMergeTo, feature);
            MergeImages(featureToMergeTo, feature);
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
            if (target.GetId().Equals(source.GetId()))
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

            if (target.Attributes[FeatureAttributes.POI_ICON].Equals("icon-bus-stop") &&
                target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                !source.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            {
                // do not merge non-osm info into bus stops
                return false;
            }

            if (!source.Attributes[FeatureAttributes.POI_SOURCE].Equals(target.Attributes[FeatureAttributes.POI_SOURCE]))
            {
                return true;
            }

            // same source
            if (!source.Attributes[FeatureAttributes.POI_ICON].Equals(target.Attributes[FeatureAttributes.POI_ICON]))
            {
                // different icon
                return false;
            }

            if (target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                target.Attributes.GetNames().Contains("railway") &&
                !source.Attributes.GetNames().Contains("railway"))
            {
                // don't merge railway with non-raileay.
                return false;
            }

            if (target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                target.Attributes.GetNames().Contains("place") &&
                !source.Attributes.GetNames().Contains("place"))
            {
                // don't merge place with non-place.
                return false;
            }

            if (target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                target.Attributes.GetNames().Contains("highway") &&
                !source.Attributes.GetNames().Contains("highway"))
            {
                // don't merge highway with non-highway.
                return false;
            }
            return true;
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
                        featureIdsToRemove.Add(wikiFeatureToRemove.GetId());
                        MergeFeatures(osmWikiFeature, wikiFeatureToRemove);
                    }
                }
            }
            WriteToBothLoggers($"Finished joining Wikipedia markers. Merged features: {featureIdsToRemove.Count}");
            return features.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
        }

        private void AddAlternativeTitleToNatureReserves(List<Feature> features)
        {
            WriteToBothLoggers("Starting adding alternative names to nature reserves");
            var natureReserveFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_ICON].Equals("icon-nature-reserve")).ToList();
            WriteToBothLoggers($"Processing {natureReserveFeatures.Count} nature reserves");
            foreach (var natureReserveFeature in natureReserveFeatures)
            {
                _reportLogger.LogInformation(string.Join(",", natureReserveFeature.GetTitles()));
                var titles = natureReserveFeature.GetTitles().Where(t => t.StartsWith("שמורת")).ToList();
                if (!titles.Any())
                {
                    continue;
                }
                foreach (var title in titles)
                {
                    var alternativeTitle = title.StartsWith("שמורת טבע")
                        ? title.Replace("שמורת טבע", "שמורת")
                        : title.Replace("שמורת", "שמורת טבע");

                    if (titles.Contains(alternativeTitle))
                    {
                        continue;
                    }

                    int index = 0;
                    do
                    {
                        index++;
                    } while (natureReserveFeature.Attributes.Exists(FeatureAttributes.NAME + ":he" + index));
                    natureReserveFeature.Attributes.AddAttribute(FeatureAttributes.NAME + ":he" + index, alternativeTitle);
                }
                natureReserveFeature.SetTitles();
            }
            WriteToBothLoggers("Finished adding alternative names to nature reserves");
        }

        private void WriteToBothLoggers(string message)
        {
            _logger.LogInformation(message);
            _reportLogger.LogInformation(message + "<br/>");
        }

        private void MergeTitles(IFeature target, IFeature source)
        {
            if (!(target.Attributes[FeatureAttributes.POI_NAMES] is AttributesTable targetTitlesByLanguage))
            {
                return;
            }
            if (!(source.Attributes[FeatureAttributes.POI_NAMES] is AttributesTable sourceTitlesByLanguage))
            {
                return;
            }

            foreach (var attributeName in sourceTitlesByLanguage.GetNames())
            {
                if (targetTitlesByLanguage.Exists(attributeName))
                {
                    targetTitlesByLanguage[attributeName] = GeoJsonExtensions.GetStringListFromAttributeValue(targetTitlesByLanguage[attributeName])
                        .Concat(GeoJsonExtensions.GetStringListFromAttributeValue(sourceTitlesByLanguage[attributeName])).Distinct().ToArray();
                }
                else
                {
                    targetTitlesByLanguage.Add(attributeName, GeoJsonExtensions.GetStringListFromAttributeValue(sourceTitlesByLanguage[attributeName]));
                }
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="target"></param>
        /// <param name="source"></param>
        private void MergeDescriptionAndAuthor(IFeature target, IFeature source)
        {
            foreach (var languagePostfix in Languages.Array.Select(s => ":" + s).Concat(new[] { string.Empty }))
            {
                if (!target.Attributes.GetNames().Contains(FeatureAttributes.DESCRIPTION + languagePostfix) &&
                    source.Attributes.GetNames().Contains(FeatureAttributes.DESCRIPTION + languagePostfix))
                {
                    CopyKeysIfExist(target, source, new[] {
                        FeatureAttributes.DESCRIPTION + languagePostfix,
                        FeatureAttributes.POI_USER_NAME,
                        FeatureAttributes.POI_USER_ADDRESS,
                        FeatureAttributes.POI_LAST_MODIFIED
                    });
                }
            }
        }

        private void MergeWebsite(IFeature target, IFeature source)
        {
            var lastExsitingIndex = target.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE)).Count();
            foreach (var key in source.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE)))
            {
                var sourceImageUrlKey = key.Replace(FeatureAttributes.WEBSITE, FeatureAttributes.POI_SOURCE_IMAGE_URL);
                if (lastExsitingIndex == 0)
                {
                    target.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, source.Attributes[key]);
                    if (source.Attributes.GetNames().Contains(sourceImageUrlKey))
                    {
                        target.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL, source.Attributes[sourceImageUrlKey]);
                    }
                } 
                else
                {
                    target.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE + lastExsitingIndex, source.Attributes[key]);
                    if (source.Attributes.GetNames().Contains(sourceImageUrlKey))
                    {
                        target.Attributes.AddOrUpdate(FeatureAttributes.POI_SOURCE_IMAGE_URL + lastExsitingIndex, source.Attributes[sourceImageUrlKey]);
                    }
                }
                lastExsitingIndex++;
            }
        }

        private void MergeGeometry(IFeature target, IFeature source)
        {
            if (!target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) ||
                !source.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            {
                // only merge geometry between OSM features
                return;
            }
            
            if (target.Geometry is GeometryCollection geometryCollection)
            {
                if (source.Geometry is GeometryCollection geometryCollectionSource)
                {
                    target.Geometry = _geometryFactory.CreateGeometryCollection(geometryCollection.Geometries.Concat(geometryCollectionSource.Geometries).ToArray());
                }
                else
                {
                    target.Geometry = _geometryFactory.CreateGeometryCollection(geometryCollection.Geometries.Concat(new[] { source.Geometry }).ToArray());
                }
            }
            else
            {
                target.Geometry = _geometryFactory.CreateGeometryCollection(new[] { target.Geometry, source.Geometry });
            }
        }

        private void MergeImages(IFeature target, IFeature source)
        {
            var lastExsitingIndex = target.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL)).Count();
            foreach (var key in source.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL)))
            {
                if (lastExsitingIndex == 0)
                {
                    target.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, source.Attributes[key]);
                }
                else
                {
                    target.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL + lastExsitingIndex, source.Attributes[key]);
                }
                lastExsitingIndex++;
            }
        }

        private void CopyKeysIfExist(IFeature target, IFeature source, string[] attributeKeys)
        {
            foreach (var key in attributeKeys)
            {
                if (source.Attributes.GetNames().Contains(key))
                {
                    target.Attributes.AddOrUpdate(key, source.Attributes[key]);
                }
            }
        }
    }
}

