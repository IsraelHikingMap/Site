using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using SkiaSharp;
using System;
using System.Linq;
using System.Security.Cryptography;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class ImagesUrlsStorageExecutor : IImagesUrlsStorageExecutor
{
    private readonly IImagesRepository _imagesRepository;
    private readonly ILogger _logger;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="imagesRepository"></param>
    /// <param name="logger"></param>
    public ImagesUrlsStorageExecutor(IImagesRepository imagesRepository,
        ILogger logger)
    {
        _imagesRepository = imagesRepository;
        _logger = logger;
    }

    private byte[] ResizeImage(byte[] content, int newSizeInPixels)
    {
        using var original = SKBitmap.Decode(content);
        var ratio = original.Width > original.Height
            ? newSizeInPixels * 1.0 / original.Width
            : newSizeInPixels * 1.0 / original.Height;
        var info = new SKImageInfo((int)(original.Width * ratio), (int)(original.Height * ratio));
        // Decoding to raw pixels and re-encoding drops any EXIF metadata.
        using var resized = original.Resize(info, new SKSamplingOptions(SKFilterMode.Linear, SKMipmapMode.Linear));
        using var image = SKImage.FromBitmap(resized);
        using var data = image.Encode(SKEncodedImageFormat.Jpeg, 90);
        return data.ToArray();
    }

    /// <inheritdoc/>
    public async Task StoreImage(MD5 md5, byte[] content, string imageUrl)
    {
        var hash = md5.ComputeHash(content).ToHashString();
        var imageItemInDatabase = await _imagesRepository.GetImageByHash(hash);
        if (imageItemInDatabase != null && !imageItemInDatabase.ImageUrls.Contains(imageUrl))
        {
            imageItemInDatabase.ImageUrls.Add(imageUrl);
            await _imagesRepository.StoreImage(imageItemInDatabase);
            return;
        }
        content = ResizeImage(content, 100);
        await _imagesRepository.StoreImage(new ImageItem
        {
            ImageUrls = [imageUrl],
            Thumbnail = "data:image/jpeg;base64," + Convert.ToBase64String(content),
            Hash = hash
        });
    }

    /// <inheritdoc/>
    public async Task<string> GetImageUrlIfExists(MD5 md5, byte[] content)
    {
        var hash = md5.ComputeHash(content).ToHashString();
        var imageItem = await _imagesRepository.GetImageByHash(hash);
        var imageUrl = imageItem?.ImageUrls.FirstOrDefault();
        if (imageUrl != null)
        {
            _logger.LogInformation($"Found exiting image with url: {imageUrl}");
        }
        return imageUrl;
    }
}