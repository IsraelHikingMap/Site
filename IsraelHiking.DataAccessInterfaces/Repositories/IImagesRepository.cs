using IsraelHiking.Common;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories;

public interface IImagesRepository
{
    Task<ImageItem> GetImageByHash(string hash);
    Task StoreImage(ImageItem imageItem);
}