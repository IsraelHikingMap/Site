using IsraelHiking.Common;
using System.Collections.Generic;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// Stores images in order to avoid uploading the same image to wikimedia twice
    /// </summary>
    public interface IImagesUrlsStorageExecutor
    {
        /// <summary>
        /// Dowonloads the content from the urls, calculates hash and stores to database
        /// </summary>
        /// <param name="imagesUrls"></param>
        /// <returns></returns>
        Task DownloadAndStoreUrls(List<string> imagesUrls);

        /// <summary>
        /// Get an image url if it exsits in the repository
        /// </summary>
        /// <param name="md5"></param>
        /// <param name="content"></param>
        /// <returns>The image url or null</returns>
        Task<string> GetImageUrlIfExists(MD5 md5, byte[] content);

        /// <summary>
        /// Gets all the images by the required urls
        /// </summary>
        /// <param name="imageUrls"></param>
        /// <returns></returns>
        Task<ImageItem[]> GetAllImagesForUrls(string[] imageUrls);
        /// <summary>
        /// This method stores images in the repostory after computing hash and resizing them
        /// </summary>
        /// <param name="md5"></param>
        /// <param name="content"></param>
        /// <param name="imageUrl"></param>
        /// <returns></returns>
        Task StoreImage(MD5 md5, byte[] content, string imageUrl);
    }
}