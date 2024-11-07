using NetTopologySuite.Geometries;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IWikimediaCommonGateway : IInitializable
    {
        Task<string> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location);
        Task<string> GetImageUrl(string pageName);
    }
}