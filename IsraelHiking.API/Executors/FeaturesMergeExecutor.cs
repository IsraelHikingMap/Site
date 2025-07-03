using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.Operation.Valid;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NetTopologySuite.Operation.Union;

namespace IsraelHiking.API.Executors;

/// <summary>
/// This comparer handles the order of which features are merged.
/// Features that are ordered first will be the target of the merge 
/// while features that are ordered last will be the source of the merge.
/// </summary>
internal class FeatureComparer : IComparer<IFeature>
{
    public int Compare(IFeature x, IFeature y)
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
    private static readonly string[] EXCLUSIVE_TAGS = ["railway", PLACE, "highway", "building", "waterway"];
        
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
    public List<IFeature> Merge(List<IFeature> osmFeatures, List<IFeature> externalFeatures)
    {
        AddAlternativeTitleToNatureReserves(osmFeatures);
        externalFeatures = MergeWikipediaAndWikidataIntoWikidata(externalFeatures);
        externalFeatures = MergeWikipediaToOsmByWikipediaTags(osmFeatures, externalFeatures);
        externalFeatures = MergeWikidataToOsmByWikidataTags(osmFeatures, externalFeatures);
        externalFeatures = MergeINatureToOsmByINatureTags(osmFeatures, externalFeatures);
        _logger.LogInformation($"Starting to sort OSM features by importance: {osmFeatures.Count}");
        osmFeatures = osmFeatures.OrderBy(f => f, new FeatureComparer()).ToList();
        _logger.LogInformation($"Finished sorting OSM features by importance: {osmFeatures.Count}");
        osmFeatures = MergePlaceNodes(osmFeatures);
        var namesAttributes = new List<string> {FeatureAttributes.NAME, FeatureAttributes.MTB_NAME};
        namesAttributes.AddRange(Languages.Array.Select(language => FeatureAttributes.NAME + ":" + language));
        foreach (var nameAttribute in namesAttributes)
        {
            osmFeatures = MergeOsmElementsByName(osmFeatures, nameAttribute);
        }
        externalFeatures = MergeExternalFeaturesToOsm(osmFeatures, externalFeatures);
        externalFeatures = externalFeatures.Where(f => !f.GetLocation().X.Equals(FeatureAttributes.INVALID_LOCATION)).ToList();
        var all = osmFeatures.Concat(externalFeatures).ToList();
        SimplifyGeometriesCollection(all);
        return all;
    }

    private List<IFeature> MergeOsmElementsByName(List<IFeature> orderedOsmFeatures, string nameAttribute)
    {
        _logger.LogInformation($"Starting OSM merging by {nameAttribute}, current items count: {orderedOsmFeatures.Count}");
        var featureIdsToRemove = new ConcurrentBag<string>();
        var groupedByName = orderedOsmFeatures.Where(f => f.Attributes.Exists(nameAttribute))
            .GroupBy(f => f.Attributes[nameAttribute].ToString()).ToList();
        _logger.LogInformation($"Finished grouping by {nameAttribute} - {groupedByName.Count}, staring to merge on {Environment.ProcessorCount / 2} processors");
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
                        if (!CanMerge(featureToMergeTo, feature))
                        {
                            continue;
                        }
                        MergeFeatures(featureToMergeTo, feature);
                        featureIdsToRemove.Add(feature.GetId());
                        features.Remove(feature);
                        merged = true;
                        break;
                    }
                    if (!merged)
                    {
                        break;
                    }
                }
                features.RemoveAt(0);
            }
        });
        var list = featureIdsToRemove.ToHashSet();
        orderedOsmFeatures = orderedOsmFeatures.Where(f => list.Contains(f.GetId()) == false).ToList();
        _logger.LogInformation($"Finished OSM merging by name, removed {list.Count} items, remaining OSM items: {orderedOsmFeatures.Count}");
        return orderedOsmFeatures;
    }

    private List<IFeature> MergeExternalFeaturesToOsm(List<IFeature> osmFeatures, List<IFeature> externalFeatures)
    {
        var featureIdsToRemove = new HashSet<string>();
        _logger.LogInformation($"Starting external features merging by title into OSM. Current OSM items: {osmFeatures.Count}, external features: {externalFeatures.Count}");
        var titlesDictionary = new Dictionary<string, List<IFeature>>();
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
                    titlesDictionary[title] = [osmFeature];
                }
            }
        }
        _logger.LogInformation("Finished preparing titles mapping, starting processing.");
        foreach (var externalFeature in externalFeatures)
        {
            var name = externalFeature.Attributes[FeatureAttributes.NAME].ToString();
            if (!titlesDictionary.ContainsKey(name))
            {
                continue;
            }
            foreach (var osmFeature in titlesDictionary[name].Where(osmFeature => CanMerge(osmFeature, externalFeature)))
            {
                MergeFeatures(osmFeature, externalFeature);
                featureIdsToRemove.Add(externalFeature.GetId());
                break;
            }
        }
        externalFeatures = externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
        _logger.LogInformation("Finished external features merging by title into OSM. Remaining external features: " + externalFeatures.Count);
        return externalFeatures;
    }

    private List<IFeature> MergePlaceNodes(List<IFeature> osmFeatures)
    {
        var featureIdsToRemove = new ConcurrentBag<string>();
        var containers = osmFeatures.Where(IsPlaceContainer).OrderBy(f => f.Geometry.Area).ToList();
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
        WriteToBothLoggers($"Finished places merging. Removed places entities: {list.Count}");
        return osmFeatures.Where(f => list.Contains(f.GetId()) == false).ToList();
    }

    private bool IsPlaceContainer(IFeature feature)
    {
        if (feature.Geometry is not Polygon && feature.Geometry is not MultiPolygon)
        {
            return false;
        }
        if (!feature.Attributes.Exists(FeatureAttributes.NAME))
        {
            return false;
        }
        var isFeatureADecentCity = feature.Attributes.Has("boundary", "administrative") &&
                                   feature.Attributes.Exists("admin_level") &&
                                   int.TryParse(feature.Attributes["admin_level"].ToString(), out int adminLevel) &&
                                   adminLevel <= 8;
        if (isFeatureADecentCity)
        {
            return true;
        }
        if (feature.Attributes.Exists(PLACE))
        {
            return true;
        }
        return false;
    }

    private List<IFeature> UpdatePlacesGeometry(IFeature feature, List<IFeature> places)
    {
        var placeContainers = places.Where(c => IsPlaceContainerContainsFeature(c, feature))
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

    private bool IsPlaceContainerContainsFeature(IFeature container, IFeature feature)
    {
        try
        {
            bool containsOrClose;
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

    private void SimplifyGeometriesCollection(List<IFeature> results)
    {
        foreach (var feature in results)
        {
            if (feature.Geometry is not GeometryCollection geometryCollection)
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
            var nonPointGeometries = geometryCollection.Geometries.Where(g => g is not Point).ToArray();
            if (nonPointGeometries.Length == 1)
            {
                feature.Geometry = nonPointGeometries.First();
                continue;
            }
            if (nonPointGeometries.All(g => g is LineString or MultiLineString))
            {
                var lines = nonPointGeometries
                    .OfType<MultiLineString>()
                    .SelectMany(mls => mls.Geometries.OfType<LineString>())
                    .Concat(nonPointGeometries.OfType<LineString>())
                    .ToArray();
                feature.Geometry = _geometryFactory.CreateMultiLineString(lines);
                continue;
            }
            if (nonPointGeometries.All(g => g is Polygon or MultiPolygon))
            {
                var polygons = nonPointGeometries
                    .OfType<MultiPolygon>()
                    .SelectMany(mls => mls.Geometries.OfType<Polygon>())
                    .Concat(nonPointGeometries.OfType<Polygon>())
                    .OrderBy(p => p.Area)
                    .ToList();

                Geometry geometry = _geometryFactory.CreateMultiPolygon(polygons.ToArray());
                var isValidOp = new IsValidOp(geometry);
                if (!isValidOp.IsValid)
                {
                    for (var i = polygons.Count - 1; i >= 0; i--)
                    {
                        for (var j = i - 1; j >= 0; j--)
                        {
                            if (!polygons[i].Overlaps(polygons[j]) 
                                && !polygons[i].Covers(polygons[j]) &&
                                !polygons[i].Intersects(polygons[j]))
                            {
                                continue;
                            }
                            var unified = UnaryUnionOp.Union([polygons[i], polygons[j]]);
                            if (unified is not Polygon polygon)
                            {
                                continue;
                            }
                            polygons[j] = polygon;
                            polygons.RemoveAt(i);
                            break;
                        }
                    }

                    geometry = polygons.Count > 1
                        ? _geometryFactory.CreateMultiPolygon(polygons.ToArray())
                        : polygons.First();
                }
                feature.Geometry = geometry;
                isValidOp = new IsValidOp(geometry);
                if (!isValidOp.IsValid)
                {
                    feature.Attributes.AddOrUpdate(FeatureAttributes.POI_CONTAINER, false);
                    _logger.LogWarning(
                        $"There was a problem merging {polygons.Count} polygons from the following feature into a multipolygon {feature.GetTitle(Languages.HEBREW)} ({feature.GetId()}), {GetWebsite(feature)} {isValidOp.ValidationError.Message} ({isValidOp.ValidationError.Coordinate.X}, {isValidOp.ValidationError.Coordinate.Y})");
                }
                continue;
            }
            if (nonPointGeometries.All(g => g is Polygon or LineString) && feature.Attributes.GetNames().Contains("highway"))
            {
                var lineStrings = nonPointGeometries
                    .OfType<LineString>()
                    .Concat(nonPointGeometries.OfType<Polygon>().Select(p => _geometryFactory.CreateLineString(p.Coordinates)))
                    .ToArray();
                feature.Geometry = _geometryFactory.CreateMultiLineString(lineStrings);
                continue;
            }
            _logger.LogWarning($"The following merge created a weird geometry: {feature.GetTitle(Languages.HEBREW)} {GetWebsite(feature)} {string.Join(", ", geometryCollection.Geometries.Select(g => g.GeometryType))}");
            feature.Geometry = nonPointGeometries.FirstOrDefault();
        }
    }

    private void WriteToReport(IFeature featureToMergeTo, IFeature feature)
    {
        if (!_options.WriteMergeReport)
        {
            return;
        }
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

    private string GetWebsite(IFeature feature)
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
        if (featureToMergeTo.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
            feature.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
        {
            // only merge geometry between OSM features
            featureToMergeTo.MergeGeometriesFrom(feature, _geometryFactory);
        }
            
        featureToMergeTo.Attributes.AddOrUpdate(FeatureAttributes.POI_MERGED, true);
        // adding attributes of merged feature
        MergeTitles(featureToMergeTo, feature);
        MergeDescriptionAndAuthor(featureToMergeTo, feature);
        MergeDates(featureToMergeTo, feature);
        MergeWebsite(featureToMergeTo, feature);
        MergeImages(featureToMergeTo, feature);

        WriteToReport(featureToMergeTo, feature);
    }

    private bool CanMerge(IFeature target, IFeature source)
    {
        if (target.GetId().Equals(source.GetId()))
        {
            return false;
        }
        var threshold = source.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
                        target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM)
            ? _options.MergePointsOfInterestThreshold
            : _options.MergeExternalPointsOfInterestThreshold;
        if (!source.GeometryContains(target) && source.Geometry.Distance(target.Geometry) > threshold)
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
            
        if (EXCLUSIVE_TAGS.Any(tagName => IsFeaturesTagsMismatched(target, source, tagName)))
        {
            return false;
        }

        if (target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) &&
            target.Attributes.GetNames().Contains("highway") &&
            source.Attributes.GetNames().Contains("highway") &&
            (source.Geometry.OgcGeometryType == OgcGeometryType.Point ||
             target.Geometry.OgcGeometryType == OgcGeometryType.Point) &&
            source.Geometry.OgcGeometryType != target.Geometry.OgcGeometryType)
        {
            // don't merge highway points with non highway points
            return false;
        }
        return true;
    }

    /// <summary>
    /// Give a tagName if target and source are OSM points and the tagName does not exist on both - don't merge them
    /// </summary>
    /// <param name="target"></param>
    /// <param name="source"></param>
    /// <param name="tagName"></param>
    /// <returns></returns>
    private bool IsFeaturesTagsMismatched(IFeature target, IFeature source, string tagName) {
        return target.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM) && 
               (target.Attributes.GetNames().Contains(tagName) &&
                !source.Attributes.GetNames().Contains(tagName) || 
                !target.Attributes.GetNames().Contains(tagName) &&
                source.Attributes.GetNames().Contains(tagName));
    }

    private List<IFeature> MergeWikipediaAndWikidataIntoWikidata(List<IFeature> externalFeatures)
    {
        WriteToBothLoggers("Starting joining Wikipedia and wikidata.");
        var wikidataFeatures = externalFeatures.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.WIKIDATA)).ToList();
        var wikipediaFeatures = externalFeatures
            .Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.WIKIPEDIA))
            .ToDictionary(f => f.Attributes[FeatureAttributes.NAME], f => f);
        var featureIdsToRemove = new HashSet<string>();
        foreach (var wikidataFeature in wikidataFeatures)
        {
            var names = wikidataFeature.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.NAME))
                .Select(n => wikidataFeature.Attributes[n].ToString());
            foreach (var name in names.Where(n => wikipediaFeatures.ContainsKey(n)))
            {
                featureIdsToRemove.Add(wikipediaFeatures[name].GetId());
                MergeFeatures(wikidataFeature, wikipediaFeatures[name]);
            }
        }
        WriteToBothLoggers($"Finished joining Wikipedia and wikidata. Merged features: {featureIdsToRemove.Count}");
        return externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
    }
        
    private List<IFeature> MergeWikipediaToOsmByWikipediaTags(List<IFeature> osmFeatures, List<IFeature> externalFeatures)
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
                if (wikiFeatureToRemove == null)
                {
                    continue;
                }
                featureIdsToRemove.Add(wikiFeatureToRemove.GetId());
                MergeFeatures(osmWikiFeature, wikiFeatureToRemove);
            }
        }
        WriteToBothLoggers($"Finished joining Wikipedia markers. Merged features: {featureIdsToRemove.Count}");
        return externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
    }
        
    private List<IFeature> MergeWikidataToOsmByWikidataTags(List<IFeature> osmFeatures, List<IFeature> externalFeatures)
    {
        WriteToBothLoggers("Starting joining Wikidata markers.");
        var featureIdsToRemove = new HashSet<string>();
        var wikidataFeatures = externalFeatures.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.WIKIDATA)).ToList();
        var osmWikiFeatures = osmFeatures.Where(f =>
                f.Attributes.GetNames().Any(n => n == FeatureAttributes.WIKIDATA) &&
                f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            .ToList();
        foreach (var osmWikiFeature in osmWikiFeatures)
        {
            var wikidataId = osmWikiFeature.Attributes[FeatureAttributes.WIKIDATA].ToString();
            var wikiFeatureToRemove = wikidataFeatures.FirstOrDefault(f => f.Attributes[FeatureAttributes.ID].ToString() == wikidataId);
            if (wikiFeatureToRemove == null)
            {
                continue;
            }
            featureIdsToRemove.Add(wikiFeatureToRemove.GetId());
            MergeFeatures(osmWikiFeature, wikiFeatureToRemove);
        }
        WriteToBothLoggers($"Finished joining Wikidata markers. Merged features: {featureIdsToRemove.Count}");
        return externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
    }
        
    private List<IFeature> MergeINatureToOsmByINatureTags(List<IFeature> osmFeatures, List<IFeature> externalFeatures)
    {
        WriteToBothLoggers("Starting joining iNature markers.");
        var featureIdsToRemove = new HashSet<string>();
        var iNatureFeatures = externalFeatures.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.INATURE)).ToList();
        var osmINatureFeatures = osmFeatures.Where(f =>
                f.Attributes.GetNames().Any(n => n == FeatureAttributes.INATURE_REF) &&
                f.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
            .ToList();
        foreach (var osmINatureFeature in osmINatureFeatures)
        {
            var iNaturePage = osmINatureFeature.Attributes[FeatureAttributes.INATURE_REF].ToString();
            var iNatureFeatureToRemove = iNatureFeatures.FirstOrDefault(f => f.Attributes[FeatureAttributes.NAME].ToString() == iNaturePage);
            if (iNatureFeatureToRemove == null)
            {
                continue;
            }
            featureIdsToRemove.Add(iNatureFeatureToRemove.GetId());
            MergeFeatures(osmINatureFeature, iNatureFeatureToRemove);
        }
        WriteToBothLoggers($"Finished joining iNature markers. Merged features: {featureIdsToRemove.Count}");
        return externalFeatures.Where(f => featureIdsToRemove.Contains(f.GetId()) == false).ToList();
    }

    private void AddAlternativeTitleToNatureReserves(List<IFeature> features)
    {
        WriteToBothLoggers("Starting adding alternative names to nature reserves");
        var natureReserveFeatures = features.Where(f => f.Attributes[FeatureAttributes.POI_ICON].Equals("icon-leaf")).ToList();
        WriteToBothLoggers($"Processing {natureReserveFeatures.Count} nature reserves");
        foreach (var natureReserveFeature in natureReserveFeatures)
        {
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
                } while (natureReserveFeature.Attributes.Exists(FeatureAttributes.NAME + ":" + Languages.HEBREW + index));
                natureReserveFeature.Attributes.Add(FeatureAttributes.NAME + ":" + Languages.HEBREW + index, alternativeTitle);
            }
            natureReserveFeature.SetTitles();
        }
        WriteToBothLoggers("Finished adding alternative names to nature reserves");
    }

    private void WriteToBothLoggers(string message)
    {
        _logger.LogInformation(message);
        if (!_options.WriteMergeReport)
        {
            return;
        }
        _reportLogger.LogInformation(message + "<br/>");
    }

    private void MergeTitles(IFeature target, IFeature source)
    {
        if (target.Attributes[FeatureAttributes.POI_NAMES] is not IAttributesTable targetTitlesByLanguage)
        {
            return;
        }
        if (source.Attributes[FeatureAttributes.POI_NAMES] is not IAttributesTable sourceTitlesByLanguage)
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
        foreach (var languagePostfix in Languages.Array.Select(s => ":" + s).Concat([string.Empty]))
        {
            if (!target.Attributes.GetNames().Contains(FeatureAttributes.DESCRIPTION + languagePostfix) &&
                source.Attributes.GetNames().Contains(FeatureAttributes.DESCRIPTION + languagePostfix))
            {
                if (!source.Attributes[FeatureAttributes.POI_SOURCE].Equals(Sources.OSM))
                {
                    target.Attributes.AddOrUpdate(FeatureAttributes.POI_EXTERNAL_DESCRIPTION + languagePostfix,
                        source.Attributes[FeatureAttributes.DESCRIPTION + languagePostfix]);
                }
                else
                {
                    CopyKeysIfExist(target, source, FeatureAttributes.DESCRIPTION + languagePostfix);
                }
                CopyKeysIfExist(target, source,
                    FeatureAttributes.POI_USER_NAME,
                    FeatureAttributes.POI_USER_ADDRESS);
            }
        }
    }

    private void MergeDates(IFeature target, IFeature source)
    {
        if (target.GetLastModified() < source.GetLastModified())
        {
            target.SetLastModified(source.GetLastModified());
        }
    }

    private void MergeWebsite(IFeature target, IFeature source)
    {
        var websiteUrls = target.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
            .Select(key => target.Attributes[key]).ToList();
        var lastExisitingIndex = websiteUrls.Count;
        foreach (var key in source.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE)))
        {
            var sourceImageUrlKey = key.Replace(FeatureAttributes.WEBSITE, FeatureAttributes.POI_SOURCE_IMAGE_URL);
            string targetImageUrlKey;
            if (websiteUrls.Contains(source.Attributes[key]))
            {
                var websiteKey = target.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.WEBSITE))
                    .First(targetKey => target.Attributes[targetKey].Equals(source.Attributes[key]));
                targetImageUrlKey = websiteKey.Replace(FeatureAttributes.WEBSITE, FeatureAttributes.POI_SOURCE_IMAGE_URL);
            }
            else if (lastExisitingIndex == 0)
            {
                target.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE, source.Attributes[key]);
                targetImageUrlKey = FeatureAttributes.POI_SOURCE_IMAGE_URL;
                lastExisitingIndex++;
            }
            else
            {
                target.Attributes.AddOrUpdate(FeatureAttributes.WEBSITE + lastExisitingIndex, source.Attributes[key]);
                targetImageUrlKey = FeatureAttributes.POI_SOURCE_IMAGE_URL + lastExisitingIndex;
                lastExisitingIndex++;
            }
            if (source.Attributes.GetNames().Contains(sourceImageUrlKey))
            {
                target.Attributes.AddOrUpdate(targetImageUrlKey, source.Attributes[sourceImageUrlKey]);
            }
        }
    }

    private void MergeImages(IFeature target, IFeature source)
    {
        var imagesUrls = target.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
            .Select(key => target.Attributes[key]).ToList();
        var lastExistingIndex = imagesUrls.Count;
        foreach (var key in source.Attributes.GetNames().Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL)))
        {
            if (imagesUrls.Contains(source.Attributes[key]))
            {
                continue;
            }
            if (lastExistingIndex == 0)
            {
                target.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL, source.Attributes[key]);
            }
            else
            {
                target.Attributes.AddOrUpdate(FeatureAttributes.IMAGE_URL + lastExistingIndex, source.Attributes[key]);
            }
            lastExistingIndex++;
        }
    }

    private void CopyKeysIfExist(IFeature target, IFeature source, params string[] attributeKeys)
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