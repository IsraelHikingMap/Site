using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

public interface IImgurGateway
{
    Task<string> UploadImage(Stream stream);
}