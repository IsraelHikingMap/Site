using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.POI
{
    public interface IPointsOfInterestAdapter
    {
        string Source { get; }
        Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language);
        Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest);
    }
}
