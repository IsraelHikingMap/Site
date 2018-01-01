using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
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

    public interface IWikipediaGateway : IPointsOfInterestGateway
    {
        Task<List<Feature>> GetByLocation(Coordinate center, string language);
        Task Initialize();
    }
}
