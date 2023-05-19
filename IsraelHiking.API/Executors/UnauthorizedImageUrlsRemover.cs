using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class UnauthorizedImageUrlsRemover : IUnauthorizedImageUrlsRemover
{
    private readonly ConfigurationData _options;
    private readonly ILogger _logger;
    
    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="options"></param>
    /// <param name="logger"></param>
    public UnauthorizedImageUrlsRemover(
        IOptions<ConfigurationData> options,
        ILogger logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    /// <inheritdoc/>
    public void RemoveImages(List<IFeature> features)
    {
        var removedImages = 0;
        var allImages = 0;
        foreach (var feature in features)
        {
            foreach (var attribute in feature.Attributes.GetNames())
            {
                if (!attribute.StartsWith(FeatureAttributes.IMAGE_URL))
                {
                    continue;
                }

                allImages++;
                var imageUrl = feature.Attributes[attribute].ToString() ?? string.Empty;
                if (_options.ImageUrlsAllowList.Any(prefix => imageUrl.Contains(prefix)))
                {
                    continue;
                }
                removedImages++;
                feature.Attributes.DeleteAttribute(attribute);
                var sourceImageUrl = attribute.Replace(FeatureAttributes.IMAGE_URL,
                    FeatureAttributes.POI_SOURCE_IMAGE_URL);
                if (feature.Attributes.Exists(sourceImageUrl))
                {
                    feature.Attributes.DeleteAttribute(sourceImageUrl);
                }
            }
        }
        _logger.LogInformation($"Removed {removedImages} out of total of {allImages} images.");
    }
}