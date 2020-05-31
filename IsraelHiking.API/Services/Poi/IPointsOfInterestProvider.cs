using IsraelHiking.Common;
using IsraelHiking.Common.Poi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class is responsible to get the points of interest from the repository
    /// </summary>
    public interface IPointsOfInterestProvider
    {
        /// <summary>
        /// Gets all the POIs within the bounding box that matches the given categories in the given language
        /// </summary>
        /// <param name="northEast">North east corner</param>
        /// <param name="southWest">South west corner</param>
        /// <param name="categories">The categories</param>
        /// <param name="language">The language</param>
        /// <returns>An array of POIs</returns>
        [Obsolete("This is no longer needed")]
        Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);

        /// <summary>
        /// This get a specific point of interest by the Id and source
        /// </summary>
        /// <param name="id"></param>
        /// <param name="source"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        Task<PointOfInterestExtended> GetPointOfInterestById(string source, string id, string language = "");

        /// <summary>
        /// Adds a POI
        /// </summary>
        /// <param name="pointOfInterest"></param>
        /// <param name="tokenAndSecret"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language);

        /// <summary>
        /// Updates a POI
        /// </summary>
        /// <param name="pointOfInterest">The POI's new data</param>
        /// <param name="tokenAndSecret">Credentials</param>
        /// <param name="language">The relevant language</param>
        /// <returns></returns>
        Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, TokenAndSecret tokenAndSecret, string language);

        /// <summary>
        /// Get the closest point to the given location, only for the given source
        /// </summary>
        /// <param name="location"></param>
        /// <param name="source">Source is optional</param>
        /// <param name="language"></param>
        /// <returns></returns>
        public Task<Feature> GetClosestPoint(Coordinate location, string source, string language = "");

        /// <summary>
        /// Get the all the points that were undated since the given date
        /// </summary>
        /// <param name="lastMoidified">The last modidifaction date that the client has</param>
        /// <returns></returns>
        public Task<Feature[]> GetUpdates(DateTime lastMoidified);
    }
}
