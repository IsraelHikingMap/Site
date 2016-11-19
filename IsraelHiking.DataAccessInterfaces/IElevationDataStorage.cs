using System.Threading.Tasks;
using IsraelHiking.Common;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage
    {
        Task Initialize();
        Task<double> GetElevation(LatLng latLng);
    }
}