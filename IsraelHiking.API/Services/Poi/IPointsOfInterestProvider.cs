using NetTopologySuite.Features;
using OsmSharp.IO.API;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi;

/// <summary>
/// The minimal information a crawler needs to render a preview of a point of interest
/// </summary>
public class PointOfInterestBasicInfo
{
    /// <summary>
    /// The title of the point of interest
    /// </summary>
    public string Title { get; set; }
    /// <summary>
    /// The description of the point of interest
    /// </summary>
    public string Description { get; set; }
    /// <summary>
    /// A single image URL representing the point of interest
    /// </summary>
    public string ImageUrl { get; set; }
}

/// <summary>
/// This class is responsible to get the points of interest from the repository
/// </summary>
public interface IPointsOfInterestProvider
{
    /// <summary>
    /// Gets the basic information (title, description and a single image) of a point of interest by its source and ID
    /// </summary>
    /// <param name="source"></param>
    /// <param name="id"></param>
    /// <param name="language">The language to get the title and description in, defaults to English</param>
    /// <returns></returns>
    Task<PointOfInterestBasicInfo> GetBasicInfo(string source, string id, string language);

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
}