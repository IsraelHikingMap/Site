using IsraelHiking.Common;
using System;
using System.Collections.Generic;
using System.Text;
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
