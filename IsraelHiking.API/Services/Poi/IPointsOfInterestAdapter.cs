using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;

namespace IsraelHiking.API.Services.Poi
{
    public interface IPointsOfInterestAdapter
    {
        string Source { get; }
        Task<PointOfInterest[]> GetPointsOfInterest(Coordinate northEast, Coordinate southWest, string[] categories, string language);
        Task<PointOfInterestExtended> GetPointOfInterestById(string id, string language);
        Task UpdatePointOfInterest(PointOfInterestExtended pointOfInterest);
    }
}
