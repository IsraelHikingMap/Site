using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Logging;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.Primitives;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class ImagesUrlsStorageExecutor : IImagesUrlsStorageExecutor
    {
        private readonly IImagesRepository _imagesRepository;
        private readonly IRemoteFileSizeFetcherGateway _remoteFileFetcherGateway;
        private readonly ILogger _logger;

        /// <summary>
        /// Constrcutor
        /// </summary>
        /// <param name="imagesRepository"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="logger"></param>
        public ImagesUrlsStorageExecutor(IImagesRepository imagesRepository,
            IRemoteFileSizeFetcherGateway remoteFileFetcherGateway,
            ILogger logger)
        {
            _imagesRepository = imagesRepository;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _logger = logger;
        }

        /// <inheritdoc/>
        public async Task DownloadAndStoreUrls(List<string> imagesUrls)
        {
            var exitingUrls = await _imagesRepository.GetAllUrls();
            var needToRemove = exitingUrls.Except(imagesUrls).ToList();
            _logger.LogInformation($"Need to remove {needToRemove.Count} images that are no longer relevant");
            foreach(var imageUrlToRemove in needToRemove)
            {
                await _imagesRepository.DeleteImageByUrl(imageUrlToRemove);
            }
            _logger.LogInformation($"Finished removing images, starting downloading and index: {imagesUrls.Count}");
            using var md5 = MD5.Create();
            var counter = 0;
            Parallel.ForEach(imagesUrls, new ParallelOptions { MaxDegreeOfParallelism = 20 }, (imageUrl) =>
            {
                try
                {
                    Interlocked.Increment(ref counter);
                    if (counter % 200 == 0)
                    {
                        _logger.LogInformation($"Indexed {counter} images of {imagesUrls.Count}");
                    }
                    if (exitingUrls.Contains(imageUrl))
                    {
                        var size = _remoteFileFetcherGateway.GetFileSize(imageUrl).Result;
                        if (size > 0)
                        {
                            return;
                        }
                    }
                    var content = new byte[0];
                    for (int retryIndex = 0; retryIndex < 3; retryIndex++)
                    {
                        try
                        {
                            if (imageUrl.StartsWith("File:"))
                            {
                                imageUrl = $"https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/{imageUrl.Replace("File:", "")}";
                            }
                            content = _remoteFileFetcherGateway.GetFileContent(imageUrl).Result.Content;
                            break;
                        }
                        catch
                        {
                            Task.Delay(200).Wait();
                        }
                    }
                    if (content.Length == 0)
                    {
                        _imagesRepository.DeleteImageByUrl(imageUrl).Wait();
                        return;
                    }
                    StoreImage(md5, content, imageUrl).Wait();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "There was a problem with the following image url: " + imageUrl + " ");
                }
            });
        }

        private byte[] ResizeImage(Image originalImage, int newSizeInPixels)
        {
            var ratio = originalImage.Width > originalImage.Height
                ? newSizeInPixels * 1.0 / originalImage.Width
                : newSizeInPixels * 1.0 / originalImage.Height;
            var newSize = new Size((int)(originalImage.Width * ratio), (int)(originalImage.Height * ratio));
            originalImage.Mutate(x => x.Resize(newSize));

            using var memoryStream = new MemoryStream();
            originalImage.SaveAsJpeg(memoryStream);
            return memoryStream.ToArray();
        }

        /// <inheritdoc/>
        public async Task StoreImage(MD5 md5, byte[] content, string imageUrl)
        {
            var hash = md5.ComputeHash(content).ToHashString();
            var image = Image.Load(content, out var _);
            var imageItemInDatabase = await _imagesRepository.GetImageByHash(hash);
            if (imageItemInDatabase != null && !imageItemInDatabase.ImageUrls.Contains(imageUrl))
            {
                imageItemInDatabase.ImageUrls.Add(imageUrl);
                await _imagesRepository.StoreImage(imageItemInDatabase);
                return;
            }
            content = ResizeImage(image, 100);
            await _imagesRepository.StoreImage(new ImageItem
            {
                ImageUrls = new List<string> { imageUrl },
                Thumbnail = $"data:image/jpeg;base64," + Convert.ToBase64String(content),
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

        /// <inheritdoc/>
        public async Task<ImageItem[]> GetAllImagesForUrls(string[] imageUrls)
        {
            var images = new List<ImageItem>();
            foreach (var imageUrl in imageUrls)
            {
                var imageItem = await _imagesRepository.GetImageByUrl(imageUrl);
                if (imageItem != null)
                {
                    images.Add(imageItem);
                }
            }
            return images.ToArray();
        }
    }
}
