using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class ExternalSourceUpdaterExecutor : IExternalSourceUpdaterExecutor
{
    private readonly IPointsOfInterestAdapterFactory _adaptersFactory;
    private readonly IExternalSourcesRepository _externalSourcesRepository;
    private readonly ILogger _logger;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="adaptersFactory"></param>
    /// <param name="externalSourcesRepository"></param>
    /// <param name="logger"></param>
    public ExternalSourceUpdaterExecutor(IPointsOfInterestAdapterFactory adaptersFactory,
        IExternalSourcesRepository externalSourcesRepository,
        ILogger logger)
    {
        _adaptersFactory = adaptersFactory;
        _externalSourcesRepository = externalSourcesRepository;
        _logger = logger;
    }

    /// <inheritdoc/>
    public async Task UpdateSource(string currentSource)
    {
        _logger.LogInformation($"Starting updating {currentSource}, getting new points...");
        var adapter = _adaptersFactory.GetBySource(currentSource);
        var exitingPois = await _externalSourcesRepository.GetExternalPoisBySource(currentSource);
        var lastModified = exitingPois.Any()
            ? exitingPois.Select(f => f.GetLastModified()).Max()
            : new DateTime();
        if (!exitingPois.Any())
        {
            _logger.LogWarning($"Source {currentSource} is empty! Try running external source rebuild to make sure the data is correct");
        }
        var features = await adapter.GetUpdates(lastModified);
        _logger.LogInformation($"Got {features.Count} points for {currentSource} that are new since last update");
        await _externalSourcesRepository.AddExternalPois(features);
        _logger.LogInformation($"Finished updating {currentSource}, indexed {features.Count} points.");
    }

    /// <inheritdoc/>
    public async Task RebuildSource(string currentSource)
    {
        _logger.LogInformation($"Starting rebuilding {currentSource}, getting points...");
        var adapter = _adaptersFactory.GetBySource(currentSource);
        var features = await adapter.GetAll();
        _logger.LogInformation($"Got {features.Count} points for {currentSource}");
        await _externalSourcesRepository.DeleteExternalPoisBySource(currentSource);
        await _externalSourcesRepository.AddExternalPois(features);
        _logger.LogInformation($"Finished rebuilding {currentSource}, indexed {features.Count} points.");
    }
}