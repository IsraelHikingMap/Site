using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Services.Osm;

/// <inheritdoc />
public class DatabasesUpdaterService : IDatabasesUpdaterService
{
    private readonly IExternalSourcesRepository _externalSourcesRepository;
    private readonly IPointsOfInterestRepository _pointsOfInterestRepository;
    private readonly IPointsOfInterestAdapterFactory _pointsOfInterestAdapterFactory;
    private readonly IPointsOfInterestFilesCreatorExecutor _pointsOfInterestFilesCreatorExecutor;
    private readonly IImagesUrlsStorageExecutor _imagesUrlsStorageExecutor;
    private readonly IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;
    private readonly IOverpassTurboGateway _overpassTurboGateway;
    private readonly ILogger _logger;

    /// <summary>
    /// Service's constructor
    /// </summary>
    /// <param name="externalSourcesRepository"></param>
    /// <param name="pointsOfInterestRepository"></param>
    /// <param name="pointsOfInterestAdapterFactory"></param>
    /// <param name="pointsOfInterestFilesCreatorExecutor"></param>
    /// <param name="imagesUrlsStorageExecutor"></param>
    /// <param name="externalSourceUpdaterExecutor"></param>
    /// <param name="overpassTurboGateway"></param>
    /// <param name="logger"></param>
    public DatabasesUpdaterService(IExternalSourcesRepository externalSourcesRepository,
        IPointsOfInterestRepository pointsOfInterestRepository,
        IPointsOfInterestAdapterFactory pointsOfInterestAdapterFactory,
        IPointsOfInterestFilesCreatorExecutor pointsOfInterestFilesCreatorExecutor,
        IImagesUrlsStorageExecutor imagesUrlsStorageExecutor,
        IExternalSourceUpdaterExecutor externalSourceUpdaterExecutor,
        IOverpassTurboGateway overpassTurboGateway,
        ILogger logger)
    {
        _externalSourcesRepository = externalSourcesRepository;
        _pointsOfInterestRepository = pointsOfInterestRepository;
        _pointsOfInterestAdapterFactory = pointsOfInterestAdapterFactory;
        _pointsOfInterestFilesCreatorExecutor = pointsOfInterestFilesCreatorExecutor;
        _imagesUrlsStorageExecutor = imagesUrlsStorageExecutor;
        _externalSourceUpdaterExecutor = externalSourceUpdaterExecutor;
        _overpassTurboGateway = overpassTurboGateway;
        _logger = logger;
    }

    /// <inheritdoc />
    public async Task Rebuild(UpdateRequest request)
    {
        // Order do matters in the sequence
        var rebuildContext = new RebuildContext
        {
            StartTime = DateTime.Now,
            Request = request,
            Succeeded = true
        };
        try
        {
            if (request.AllExternalSources)
            {
                await UpdateExternalSources();
            }
            if (request.Images)
            {
                await RebuildImages();
            }
            if (request.SiteMap)
            {
                await RebuildSiteMap();
            }
            if (request.OfflinePoisFile)
            {
                await RebuildOfflineFiles();
            }
        }
        catch (Exception ex)
        {
            rebuildContext.Succeeded = false;
            rebuildContext.ErrorMessage = ex.Message;
            _logger.LogError(ex, "Failed rebuilding databases");
        }
        finally
        {
            await _pointsOfInterestRepository.StoreRebuildContext(rebuildContext);
        }
            
    }

    private async Task RebuildImages()
    {
        _logger.LogInformation("Starting rebuilding images database.");
        var features = await _pointsOfInterestRepository.GetAllPointsOfInterest();
        var featuresUrls = features.SelectMany(f =>
            f.Attributes.GetNames()
                .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL))
                .Select(k => f.Attributes[k].ToString())
        );
        var urls = await _overpassTurboGateway.GetImagesUrls();
        await _imagesUrlsStorageExecutor.DownloadAndStoreUrls(urls.Union(featuresUrls).ToList());
        _logger.LogInformation("Finished rebuilding images database.");
    }

    private async Task RebuildSiteMap()
    {
        _logger.LogInformation("Starting rebuilding sitemap.");
        var features = await _pointsOfInterestRepository.GetAllPointsOfInterest();
        _pointsOfInterestFilesCreatorExecutor.CreateSiteMapXmlFile(features);
        _logger.LogInformation("Finished rebuilding sitemap.");
    }

    private async Task RebuildOfflineFiles()
    {
        _logger.LogInformation($"Starting rebuilding offline files.");
        var references = await _overpassTurboGateway.GetExternalReferences();
        var sources = _pointsOfInterestAdapterFactory.GetAll().Select(s => s.Source);
        var externalFeatures = new List<IFeature>();
        foreach (var source in sources)
        {
            var features = await _externalSourcesRepository.GetExternalPoisBySource(source);
            if (!references.TryGetValue(source, out var reference))
            {
                externalFeatures.AddRange(features);
                continue;
            }
            var referencesNames = reference.ToHashSet();
            _logger.LogInformation($"Got {referencesNames.Count} references from OSM file for {source}.");
            foreach (var feature in features)
            {
                if (feature.Attributes.GetNames().Any(n => n == FeatureAttributes.NAME) &&
                    referencesNames.Contains(feature.Attributes[FeatureAttributes.NAME]))
                {
                    continue;
                }
                if (feature.Attributes.GetNames().Any(n => n == FeatureAttributes.ID) &&
                    referencesNames.Contains(feature.Attributes[FeatureAttributes.ID]))
                {
                    continue;
                }
                externalFeatures.Add(feature);
            }
        }
        _logger.LogInformation($"Starting rebuilding offline files with {externalFeatures.Count} features.");
        _pointsOfInterestFilesCreatorExecutor.CreateExternalPoisFile(externalFeatures);
        _logger.LogInformation("Finished rebuilding offline pois file.");
    }

    private async Task UpdateExternalSources()
    {
        _logger.LogInformation("Starting updating external sources.");
        foreach (var source in _pointsOfInterestAdapterFactory.GetAll().Select(s => s.Source))
        {
            await _externalSourceUpdaterExecutor.UpdateSource(source);
        }
        _logger.LogInformation("Finished updating external sources.");
    }
}