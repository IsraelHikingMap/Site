using NetTopologySuite.Geometries;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage
    {
        Task Initialize();
        Task<double> GetElevation(Coordinate latLng);
    }
}