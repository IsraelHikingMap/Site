using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi;

/// <summary>
/// Points of interest adapter for Wikidata data
/// </summary>
public class WikidataPointsOfInterestAdapter : IPointsOfInterestAdapter
{
    private readonly IWikidataGateway _wikidataGateway;
    private readonly ILogger _logger;

    /// <summary>
    /// Class constructor
    /// </summary>
    /// <param name="wikidataGateway"></param>
    /// <param name="logger"></param>
    public WikidataPointsOfInterestAdapter(IWikidataGateway wikidataGateway,
        ILogger logger)
    {
        _logger = logger;
        _wikidataGateway = wikidataGateway;
    }

    /// <inheritdoc />
    public string Source => Sources.WIKIDATA;

    /// <inheritdoc />
    public async Task<List<IFeature>> GetAll()
    {
        _logger.LogInformation("Starting getting Wikidata items for indexing.");
        var startCoordinate = new Coordinate(34, 29);
        var endCoordinate = new Coordinate(36, 34);
        var allFeatures = await _wikidataGateway.GetByBoundingBox(startCoordinate, endCoordinate);
        _logger.LogInformation($"Finished getting Wikidata items for indexing, got {allFeatures.Count} items.");
        return allFeatures;
    }

    /// <inheritdoc />
    public async Task<List<IFeature>> GetUpdates(DateTime lastModifiedDate)
    {
        var features = await GetAll();
        return features.Where(f => f.GetLastModified() > lastModifiedDate).ToList();
    }
}