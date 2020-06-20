using IsraelHiking.Common;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IImagesRepository
    {
        Task<ImageItem> GetImageByUrl(string url);
        Task<ImageItem> GetImageByHash(string hash);
        Task<List<string>> GetAllUrls();
        Task StoreImage(ImageItem imageItem);
        Task DeleteImageByUrl(string url);
    }
}
