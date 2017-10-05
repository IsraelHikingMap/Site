using System.IO;
using System.Threading.Tasks;
using GeoAPI.Geometries;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IWikipediaGateway
    {
        Task Initialize();
        Task<string> UploadImage(string title, string fileName, Stream contentStream, Coordinate location);
        Task<string> GetImageUrl(string pageName);
    }
}