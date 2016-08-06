using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage
    {
        Task Initialize();
        Task<double> GetElevation(double lat, double lng);
    }
}