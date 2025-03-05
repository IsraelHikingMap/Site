using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.IO.API;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi;

/// <summary>
/// This class is responsible to get the points of interest from the repository
/// </summary>
public interface IPointsOfInterestProvider
{
    /// <summary>
    /// This get a specific point of interest its ID and source
    /// </summary>
    /// <param name="id"></param>
    /// <param name="source"></param>
    /// <returns></returns>
    Task<IFeature> GetFeatureById(string source, string id);

    /// <summary>
    /// Adds a POI
    /// </summary>
    /// <param name="feature">The POI's data to add</param>
    /// <param name="osmGateway"></param>
    /// <param name="language"></param>
    /// <returns></returns>
    Task<IFeature> AddFeature(IFeature feature, IAuthClient osmGateway, string language);

    /// <summary>
    /// Updates a POI
    /// </summary>
    /// <param name="partialFeature">The POI's new data - only added or deleted data will be in this feature</param>
    /// <param name="osmGateway"></param>
    /// <param name="language">The relevant language</param>
    /// <returns></returns>
    Task<IFeature> UpdateFeature(IFeature partialFeature, IAuthClient osmGateway, string language);

    /// <summary>
    /// Get the closest point to the given location, only for the given source
    /// Empty source means all sources
    /// </summary>
    /// <param name="location"></param>
    /// <param name="source"></param>
    /// <param name="language"></param>
    /// <returns></returns>
    public Task<IFeature> GetClosestPoint(Coordinate location, string source, string language);
}