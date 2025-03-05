using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Poi;

/// <summary>
/// Adapts from nakeb interface to business logic point of interest
/// </summary>
public class NakebPointsOfInterestAdapter : IPointsOfInterestAdapter
{
    /// <inheritdoc />
    public string Source => Sources.NAKEB;

    private readonly INakebGateway _nakebGateway;
    private readonly ILogger _logger;
    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="nakebGateway"></param>
    /// <param name="logger"></param>
    public NakebPointsOfInterestAdapter(INakebGateway nakebGateway,
        ILogger logger)
    {
        _nakebGateway = nakebGateway;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task<List<IFeature>> GetAll()
    {
        _logger.LogInformation("Getting data from Nakeb.");
        var slimFeatures = await _nakebGateway.GetAll();
        var features = new List<IFeature>();
        foreach (var slimFeature in slimFeatures)
        {
            features.Add(await _nakebGateway.GetById(slimFeature.Attributes[FeatureAttributes.ID].ToString()));
        }
        _logger.LogInformation($"Got {features.Count} routes from Nakeb.");
        return features;
    }

    /// <inheritdoc />
    public async Task<List<IFeature>> GetUpdates(DateTime lastModifiedDate)
    {
        var slimFeatures = await _nakebGateway.GetAll();
        var features = new List<IFeature>();
        foreach (var slimFeature in slimFeatures.Where(f => f.GetLastModified() > lastModifiedDate))
        {
            features.Add(await _nakebGateway.GetById(slimFeature.Attributes[FeatureAttributes.ID].ToString()));
        }
        return features;
    }
}