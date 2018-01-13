using System.IO;
using System.Threading.Tasks;
using GeoAPI.Geometries;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IWikimediaCommonGateway
    {
        Task Initialize();
        Task<string> UploadImage(string title, string author, string fileName, Stream contentStream, Coordinate location);
        Task<string> GetImageUrl(string pageName);
    }
}