using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

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
        public List<Feature> Merge(List<Feature> osmFeatures, List<Feature> externalFeatures)
        {
            AddAlternativeTitleToNatureReserves(osmFeatures);
            externalFeatures = MergeWikipediaToOsmByWikipediaTags(osmFeatures, externalFeatures);
            osmFeatures = MergeOsmElementsByName(osmFeatures);
            externalFeatures = MergeExternalFeaturesToOsm(osmFeatures, externalFeatures);
            var all = osmFeatures.Concat(externalFeatures).ToList();
            SimplifyGeometriesCollection(all);
            return all;
        }

        private List<Feature> MergeOsmElementsByName(List<Feature> osmFeatures)
        {
            _logger.LogInformation("Starting OSM merging by name.");
            var featureIdsToRemove = new ConcurrentBag<string>();
            osmFeatures = osmFeatures.OrderBy(f => f, new FeatureComparer()).ToList();
            _logger.LogInformation($"Sorted features by importance: {osmFeatures.Count}");
            osmFeatures = MergePlaceNodes(osmFeatures);
            var groupedByName = osmFeatures.Where(f => f.Attributes.Exists(FeatureAttributes.NAME))
                .GroupBy(f => f.Attributes[FeatureAttributes.NAME].ToString()).ToList();
            _logger.LogInformation($"Finished grouping by name: {groupedByName.Count}");
            Parallel.For(0, groupedByName.Count, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount / 2 }, (groupIndex) =>
            {
                var features = groupedByName[groupIndex].ToList();
                while (features.Count > 0)
                {
                    while (features.Count > 1)
                    {
                        var merged = false;
                        var featureToMergeTo = features.First();
                        for (int index = 1; index < features.Count; index++)
                        {
                            var feature = features.ElementAt(index);
                            if (CanMerge(featureToMergeTo, feature))
                            {
                                MergeFeatures(featureToMergeTo, feature);
                                featureIdsToRemove.Add(feature.GetId());
                                features.Remove(feature);
                                merged = true;
                                break;
                            }
                        }
                        if (!merged)
                        {
                            break;
                        }
                    }
                    features.RemoveAt(0);
                }
            });
            _logger.LogInformation($"Finished processing geometries, removing items.");
            var list = featureIdsToRemove.ToHashSet();
            osmFeatures = osmFeatures.Where(f => list.Contains(f.GetId()) == false).ToList();
            _logger.LogInformation($"Finished OSM merging by name: {osmFeatures.Count()}");
            return osmFeatures;
        }

        private List<Feature> MergeExternalFeaturesToOsm(List<Feature> osmFeatures, List<Feature> externalFeatures)
        {
            var featureIdsToRemove = new HashSet<string>();
            _logger.LogInformation("Starting external features merging by title into OSM.");
            var titlesDictionary = new Dictionary<string, List<Feature>>();
            foreach (var osmFeature in osmFeatures)
            {
                foreach (var title in osmFeature.GetTitles())
                {
                    if (titlesDictionary.ContainsKey(title))
                    {
                        titlesDictionary[title].Add(osmFeature);
                    }
                    else
                    {
                        titlesDictionary[title] = new List<Feature> { osmFeature };
                    }
                }
            }
            _logger.LogInformation("Finished preparing titles mapping, starting processing.");
            for (int externalFeatureIndex = 0; externalFeatureIndex < externalFeatures.Count; externalFeatureIndex++)
            {
                Feature externalFeature = externalFeatures[externalFeatureIndex];
                var name = externalFeature.Attributes[FeatureAttributes.NAME].ToString();
                if (!titlesDictionary.ContainsKey(name))
                {
                    continue;
                }
                foreach (var osmFeature in titlesDictionary[name])
                {
                    if (CanMerge(osmFeature, externalFeature))
                    {
                        MergeFeatures(osmFeature, externalFeature);
                        featureIdsToRemove.Add(externalFeature.GetId());
                        break;
                    }
                }
            }
            externalFeatures = externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
            _logger.LogInformation("Finisehd external features merging by title into OSM. " + externalFeatures.Count);
            return externalFeatures;
        }

        private List<Feature> MergePlaceNodes(List<Feature> osmFeatures)
        {
            var featureIdsToRemove = new ConcurrentBag<string>();
            var containers = osmFeatures.Where(f => f.IsValidContainer()).OrderBy(f => f.Geometry.Area).ToList();
            var places = osmFeatures.Where(f => f.Geometry is Point && f.Attributes.Exists(PLACE) && f.Attributes.Exists(FeatureAttributes.NAME)).ToList();
            WriteToBothLoggers($"Starting places merging places: {places.Count}, to containers: {containers.Count}");
            Parallel.For(0, places.Count, new ParallelOptions { MaxDegreeOfParallelism = Environment.ProcessorCount / 2 }, (placeIndex) =>
            {
                var placesToRemove = UpdatePlacesGeometry(places[placeIndex], containers);
                if (placesToRemove.Any())
                {
                    // database places are nodes that should not be removed.
                    var ids = placesToRemove.Select(p => p.GetId()).ToList();
                    foreach (var id in ids)
                    {
                        featureIdsToRemove.Add(id);
                    }
                }
            });
            var list = featureIdsToRemove.ToList();
            WriteToBothLoggers($"Finished places merging. Merged places: {list.Count}");
            return osmFeatures.Where(f => list.Contains(f.GetId()) == false).ToList();
        }

        private List<Feature> UpdatePlacesGeometry(Feature feature, List<Feature> places)
        {
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

        private bool IsPlaceContainer(Feature container, Feature feature)
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
                return "https://www.openstreetmap.org/" + feature.GetOsmType().ToString().ToLowerInvariant() + "/" + feature.GetOsmId();
            }

            return string.Empty;
        }

        private void MergeFeatures(Feature featureToMergeTo, Feature feature)
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
            MergeDates(featureToMergeTo, feature);
            MergeWebsite(featureToMergeTo, feature);
            MergeImages(featureToMergeTo, feature);

            WriteToReport(featureToMergeTo, feature);
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

            if (Categories.Routes.Contains(source.Attributes[FeatureAttributes.POI_CATEGORY].ToString()) != Categories.Routes.Contains(target.Attributes[FeatureAttributes.POI_CATEGORY].ToString()))
            {
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

        private List<Feature> MergeWikipediaToOsmByWikipediaTags(List<Feature> osmFeatures, List<Feature> externalFeatures)
        {
            WriteToBothLoggers("Starting joining Wikipedia markers.");
            var featureIdsToRemove = new HashSet<string>();
            var wikiFeatures = externalFeatures.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.WIKIPEDIA)).ToList();
            var osmWikiFeatures = osmFeatures.Where(f =>
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
                        wikiFeatures.Remove(wikiFeatureToRemove);
                        featureIdsToRemove.Add(wikiFeatureToRemove.GetId());
                        MergeFeatures(osmWikiFeature, wikiFeatureToRemove);
                    }
                }
            }
            WriteToBothLoggers($"Finished joining Wikipedia markers. Merged features: {featureIdsToRemove.Count}");
            return externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
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
                    natureReserveFeature.Attributes.Add(FeatureAttributes.NAME + ":he" + index, alternativeTitle);
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

        private void MergeTitles(Feature target, Feature source)
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
        private void MergeDescriptionAndAuthor(Feature target, Feature source)
        {
            foreach (var languagePostfix in Languages.Array.Select(s => ":" + s).Concat(new[] { string.Empty }))
            {
                if (!target.Attributes.GetNames().Contains(FeatureAttributes.DESCRIPTION + languagePostfix) &&
                    source.Attributes.GetNames().Contains(FeatureAttributes.DESCRIPTION + languagePostfix))
                {
                    CopyKeysIfExist(target, source, 
                        FeatureAttributes.DESCRIPTION + languagePostfix,
                        FeatureAttributes.POI_USER_NAME,
                        FeatureAttributes.POI_USER_ADDRESS);
                }
            }
        }

        private void MergeDates(Feature target, Feature source)
        {
            if (DateTime.Parse(target.Attributes[FeatureAttributes.POI_LAST_MODIFIED].ToString()) <
                DateTime.Parse(source.Attributes[FeatureAttributes.POI_LAST_MODIFIED].ToString()))
            {
                CopyKeysIfExist(target, source, FeatureAttributes.POI_LAST_MODIFIED);
            }
        }

        private void MergeWebsite(Feature target, Feature source)
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

        private void MergeGeometry(Feature target, Feature source)
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

        private void MergeImages(Feature target, Feature source)
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

        private void CopyKeysIfExist(Feature target, Feature source, params string[] attributeKeys)
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

