using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class represent a POI adapter.
    /// </summary>
    public interface IPointsOfInterestAdapter
    {
        /// <summary>
        /// The source of the POIs
        /// </summary>
        string Source { get; }
        /// <summary>
        /// Gets all the POIs within the bounding box that matches the given categories in the given language
        /// </summary>
        /// <param name="northEast">North east corner</param>
        /// <param name="southWest">South west corner</param>
        /// <param name="categories">The categories</param>
        /// <param name="language">The language</param>
        /// <returns>An array of POIs</returns>
        Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        /// <summary>
        /// This method should be used to get more information on a given POI
        /// </summary>
        /// <param name="id">The POI's ID</param>
        /// <param name="language">The relevant language</param>
        /// <returns>A POI with more data</returns>
        Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language);
        /// <summary>
        /// USe this function to update a POI
        /// </summary>
        /// <param name="pointOfInterest">The POI's new data</param>
        /// <param name="tokenAndSecret">Credentials</param>
        /// <param name="language">The relevant language</param>
        /// <returns></returns>
        Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language);
    }
}
