using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IPointsOfInterestGateway
    {
        Task<List<Feature>> GetAll();
        Task<FeatureCollection> GetById(string id);
    }

    // the following are used for dependency injection
    public interface IOffRoadGateway : IPointsOfInterestGateway
    {
    }

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
        Task<FeatureCollection> GetByPageTitle(string title, string language);
        Task<List<Feature>> GetByLocation(Coordinate center, string language);
        Reference GetReference(string title, string language);
    }
}
