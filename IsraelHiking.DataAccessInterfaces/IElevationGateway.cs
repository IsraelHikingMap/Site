using NetTopologySuite.Geometries;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IElevationGateway
    {
        Task<double> GetElevation(Coordinate latLng);
        
        Task<double[]> GetElevation(Coordinate[] latLngs);
    }
}