using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage
    {
        Task Initialize();
        Task<double> GetElevation(Coordinate latLng);
    }
}