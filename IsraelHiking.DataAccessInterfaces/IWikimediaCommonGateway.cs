using NetTopologySuite.Geometries;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

public interface IWikimediaCommonGateway
{
    Task<string> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location);
}