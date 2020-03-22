using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
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
            _logger.LogInformation($"Finished removing images");
            using (var md5 = MD5.Create())
            {
                var counter = 0;
                Parallel.ForEach(imagesUrls, new ParallelOptions { MaxDegreeOfParallelism = 20 }, (imageUrl) =>
                {
                    try
                    {
                        Interlocked.Increment(ref counter);
                        if (counter % 100 == 0)
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
                        _logger.LogWarning("There was a problem with the following image url: " + imageUrl + " " + ex.ToString());
                    }
                });
            }
        }

        private byte[] ResizeImage(Image originalImage, int newSizeInPixels)
        {
            var ratio = originalImage.Width > originalImage.Height
                ? newSizeInPixels * 1.0 / originalImage.Width
                : newSizeInPixels * 1.0 / originalImage.Height;
            var newSize = new Size((int)(originalImage.Width * ratio), (int)(originalImage.Height * ratio));
            originalImage.Mutate(x => x.Resize(newSize));

            var memoryStream = new MemoryStream();
            originalImage.SaveAsJpeg(memoryStream);
            return memoryStream.ToArray();
        }

        /// <inheritdoc/>
        public Task StoreImage(MD5 md5, byte[] content, string imageUrl)
        {
            var hash = md5.ComputeHash(content).ToHashString();
            var image = Image.Load(content, out var _);
            content = ResizeImage(image, 200);
            return _imagesRepository.StoreImage(new ImageItem
            {
                ImageUrl = imageUrl,
                Data = $"data:image/jpeg;base64," + Convert.ToBase64String(content),
                Hash = hash
            });
        }

        /// <inheritdoc/>
        public async Task<string> GetImageUrlIfExists(MD5 md5, byte[] content)
        {
            var hash = md5.ComputeHash(content).ToHashString();
            var imageItem = await _imagesRepository.GetImageByHash(hash);
            var imageUrl = imageItem?.ImageUrl;
            if (imageUrl != null)
            {
                _logger.LogInformation($"Found exiting image with url: {imageUrl}");
            }
            return imageUrl;
        }
    }
}
