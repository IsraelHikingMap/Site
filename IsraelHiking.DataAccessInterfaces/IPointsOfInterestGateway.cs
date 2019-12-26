using GeoAPI.Geometries;
using IsraelHiking.Common.Poi;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IPointsOfInterestGateway
    {
        Task<List<Feature>> GetAll();
        Task<Feature> GetById(string id);
    }

    // the following are used for dependency injection

    public interface INakebGateway : IPointsOfInterestGateway
    {
    }

    public interface IINatureGateway : IPointsOfInterestGateway
    {
        Task Initialize();
    }

    public interface IWikipediaGateway : IPointsOfInterestGateway
    {
        Task Initialize();
        Task<Feature> GetByPageTitle(string title, string language);
        Task<List<Feature>> GetByBoundingBox(Coordinate sourhWest, Coordinate northEast, string language);
        Reference GetReference(string title, string language);
    }
}
