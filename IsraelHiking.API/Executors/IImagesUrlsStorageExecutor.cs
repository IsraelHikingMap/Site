using System.Security.Cryptography;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors;

/// <summary>
/// Stores images in order to avoid uploading the same image to wikimedia twice
/// </summary>
public interface IImagesUrlsStorageExecutor
{
    /// <summary>
    /// Get an image url if it exists in the repository
    /// </summary>
    /// <param name="md5"></param>
    /// <param name="content"></param>
    /// <returns>The image url or null</returns>
    Task<string> GetImageUrlIfExists(MD5 md5, byte[] content);

    /// <summary>
    /// This method stores images in the repository after computing hash and resizing them
    /// </summary>
    /// <param name="md5"></param>
    /// <param name="content"></param>
    /// <param name="imageUrl"></param>
    /// <returns></returns>
    Task StoreImage(MD5 md5, byte[] content, string imageUrl);
}