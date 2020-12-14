using IsraelHiking.Common.Api;
using IsraelHiking.Common.Poi;
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
        /// Gets all the POIs within the bounding box that matches the given categories in the given language
        /// </summary>
        /// <param name="northEast">North east corner</param>
        /// <param name="southWest">South west corner</param>
        /// <param name="categories">The categories</param>
        /// <param name="language">The language</param>
        /// <returns>An array of POIs</returns>
        Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);

        /// <summary>
        /// This get a specific point of interest by the Id and source
        /// </summary>
        /// <param name="id"></param>
        /// <param name="source"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        Task<Feature> GetFeatureById(string source, string id, string language = "");

        /// <summary>
        /// Gets all the POIs within the bounding box that matches the given categories in the given language
        /// </summary>
        /// <param name="northEast">North east corner</param>
        /// <param name="southWest">South west corner</param>
        /// <param name="categories">The categories</param>
        /// <param name="language">The language</param>
        /// <returns>An array of POIs</returns>
        Task<Feature[]> GetFeatures(Coordinate northEast, Coordinate southWest, string[] categories, string language);

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
        /// <param name="pointOfInterest">The POI's data to add</param>
        /// <param name="osmGateway"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        Task<PointOfInterestExtended> AddPointOfInterest(PointOfInterestExtended pointOfInterest, IAuthClient osmGateway, string language);

        /// <summary>
        /// Updates a POI
        /// </summary>
        /// <param name="pointOfInterest">The POI's new data</param>
        /// <param name="osmGateway"></param>
        /// <param name="language">The relevant language</param>
        /// <returns></returns>
        Task<PointOfInterestExtended> UpdatePointOfInterest(PointOfInterestExtended pointOfInterest, IAuthClient osmGateway, string language);

        /// <summary>
        /// Adds a POI
        /// </summary>
        /// <param name="pointOfInterest">The POI's data to add</param>
        /// <param name="osmGateway"></param>
        /// <param name="language"></param>
        /// <returns></returns>
        Task<Feature> AddFeature(Feature feature, IAuthClient osmGateway, string language);

        /// <summary>
        /// Updates a POI
        /// </summary>
        /// <param name="pointOfInterest">The POI's new data</param>
        /// <param name="osmGateway"></param>
        /// <param name="language">The relevant language</param>
        /// <returns></returns>
        Task<Feature> UpdateFeature(Feature feature, IAuthClient osmGateway, string language);

        /// <summary>
        /// Get the closest point to the given location, only for the given source
        /// </summary>
        /// <param name="location"></param>
        /// <param name="source">Source is optional</param>
        /// <param name="language"></param>
        /// <returns></returns>
        public Task<Feature> GetClosestPoint(Coordinate location, string source, string language = "");

        /// <summary>
        /// Get the all the points that were undated since the given date, and up until a given data
        /// </summary>
        /// <param name="lastMoidified">The last modidifaction date that the client has</param>
        /// <param name="modifiedUntil">The end time of the updates to reduce response size</param>
        /// <returns></returns>
        public Task<UpdatesResponse> GetUpdates(DateTime lastMoidified, DateTime modifiedUntil);

        /// <summary>
        /// Get all points from the OSM repository
        /// </summary>
        /// <returns></returns>
        public Task<List<Feature>> GetAll();
    }
}
