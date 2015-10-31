using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationDataStorage
    {
        Task Initialize();
        double GetElevation(double lat, double lng);
    }
}