using NetTopologySuite.Geometries;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage : IInitializable
    {
        Task<double> GetElevation(Coordinate latLng);
    }
}