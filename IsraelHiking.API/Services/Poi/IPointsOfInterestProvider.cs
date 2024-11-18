using IsraelHiking.Common.Api;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Poi
{
    /// <summary>
    /// This class is responsible to get the points of interest from the repository
    /// </summary>
    public interface IPointsOfInterestProvider
    {
        /// <summary>
        /// This get a specific point of interest by the Id and source
        /// </summary>
        /// <param name="id"></param>
        /// <param name="source"></param>
        /// <returns></returns>
        Task<IFeature> GetFeatureById(string source, string id);

        /// <summary>
        /// Gets all the POIs within the bounding box that matches the given categories in the given language
        /// </summary>
        /// <param name="northEast">North east corner</param>
        /// <param name="southWest">South west corner</param>
        /// <param name="categories">The categories</param>
        /// <param name="language">The language</param>
        /// <returns>An array of POIs</returns>
        Task<IFeature[]> GetFeatures(Coordinate northEast, Coordinate southWest, string[] categories, string language);

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
        /// </summary>
        /// <param name="location"></param>
        /// <param name="source">Source is optional</param>
        /// <param name="language"></param>
        /// <returns></returns>
        public Task<IFeature> GetClosestPoint(Coordinate location, string source, string language = "");

        /// <summary>
        /// Get all points from the OSM repository
        /// </summary>
        /// <returns></returns>
        public Task<List<IFeature>> GetAll();
    }
}
