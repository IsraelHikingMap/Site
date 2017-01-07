using System.Threading.Tasks;
using GeoAPI.Geometries;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage
    {
        Task Initialize();
        Task<double> GetElevation(Coordinate latLng);
    }
}