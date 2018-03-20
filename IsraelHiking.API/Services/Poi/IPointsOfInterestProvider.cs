using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;

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
    }
}
