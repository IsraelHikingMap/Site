using System.Collections.Generic;
using NetTopologySuite.Features;

namespace IsraelHiking.API.Executors;

/// <summary>
/// A class that should remove unauthorized image urls
/// </summary>
public interface IUnauthorizedImageUrlsRemover
{
    /// <summary>
    /// Removes all images that are not part of the allow list configuration options
    /// </summary>
    /// <param name="features"></param>
    void RemoveImages(List<IFeature> features);
}