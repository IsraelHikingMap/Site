using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;
using SixLabors.Primitives;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Xml.Serialization;

namespace IsraelHiking.API.Executors
{
    internal class ImageItem
    {
        public string ImageUrl { get; set; }
        public string Data { get; set; }
    }

    /// <inheritdoc/>
    public class PointsOfInterestFilesCreatorExecutor : IPointsOfInterestFilesCreatorExecutor
    {
        private readonly IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger _logger;
        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="remoteFileFetcherGateway"></param>
        /// <param name="environment"></param>
        /// <param name="logger"></param>
        public PointsOfInterestFilesCreatorExecutor(IFileSystemHelper fileSystemHelper,
            IRemoteFileFetcherGateway remoteFileFetcherGateway,
            IWebHostEnvironment environment,
            ILogger logger)
        {
            _fileSystemHelper = fileSystemHelper;
            _remoteFileFetcherGateway = remoteFileFetcherGateway;
            _environment = environment;
            _logger = logger;
        }

        /// <inheritdoc/>
        public void Create(List<Feature> features)
        {
            _logger.LogInformation($"Starting points of interterest files creation: {features.Count}.");
            CreateSitemapXmlFile(features);
            CreateOfflinePoisFile(features);
            _logger.LogInformation($"Finished points of interterest files creation: {features.Count}.");
        }

        private void CreateSitemapXmlFile(List<Feature> features)
        {
            using (var fileStream = _fileSystemHelper.CreateWriteStream(Path.Combine(_environment.WebRootPath, "sitemap.xml")))
            {
                var list = features.Select(p =>
                {
                    var dateString = DateTime.Now.ToUniversalTime().ToString("o");
                    if (p.Attributes.Exists(FeatureAttributes.POI_LAST_MODIFIED))
                    {
                        if (p.Attributes[FeatureAttributes.POI_LAST_MODIFIED] is DateTime dateTime)
                        {
                            dateString = dateTime.ToUniversalTime().ToString("o");
                        }
                        else
                        {
                            dateString = p.Attributes[FeatureAttributes.POI_LAST_MODIFIED].ToString();
                        }
                    }
                    return new tUrl
                    {
                        lastmod = dateString,
                        loc = "https://israelhiking.osm.org.il/poi/" + p.Attributes[FeatureAttributes.POI_SOURCE] + "/" + p.Attributes[FeatureAttributes.ID],
                    };
                });
                var siteMap = new urlset
                {
                    url = list.Concat(new[] { new tUrl {
                        loc = "https://israelhiking.osm.org.il/",
                        lastmod =  DateTime.Now.ToUniversalTime().ToString("o")
                    }}).ToArray()
                };
                var serializer = new XmlSerializer(typeof(urlset));
                serializer.Serialize(fileStream, siteMap);
            }
        }

        private void CreateOfflinePoisFile(List<Feature> features)
        {
            var collection = new FeatureCollection();
            foreach (var feature in features)
            {
                collection.Add(feature);
            }
            var outputMemStream = new MemoryStream();
            using (var zipStream = new ZipOutputStream(outputMemStream))
            {
                zipStream.SetLevel(9);

                var newEntry = new ZipEntry("pois/pois.geojson")
                {
                    DateTime = DateTime.Now
                };
                zipStream.PutNextEntry(newEntry);
                StreamUtils.Copy(new MemoryStream(collection.ToBytes()), zipStream, new byte[4096]);
                zipStream.CloseEntry();

                //CreateImagesJsonFiles(features, zipStream);
                zipStream.Finish();
                outputMemStream.Position = 0;
                
                _fileSystemHelper.WriteAllBytes("pois.ihm", outputMemStream.ToArray());
            }
        }

        private void CreateImagesJsonFiles(List<Feature> features, ZipOutputStream zipStream)
        {
            _logger.LogInformation("Staring Image file creation: " + features.Count + " features");
            var items = new ConcurrentBag<ImageItem>();
            var size = 200;
            Parallel.ForEach(features, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (feature) =>
            {
                var urls = feature.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL)).Select(n => feature.Attributes[n].ToString())
                    .Where(u => !string.IsNullOrWhiteSpace(u));
                foreach (var url in urls)
                {
                    var needResize = true;
                    var updatedUrl = url;
                    var pattern = @"(http.*\/\/upload\.wikimedia\.org\/wikipedia\/(commons|he|en)\/)(.*\/)(.*)";
                    if (Regex.Match(url, pattern).Success)
                    {
                        updatedUrl = Regex.Replace(url, pattern, $"$1thumb/$3$4/{size}px-$4");
                        updatedUrl = url.EndsWith(".svg") ? updatedUrl + ".png" : updatedUrl;
                        needResize = false;
                    }
                    try
                    {
                        var content = _remoteFileFetcherGateway.GetFileContent(updatedUrl).Result.Content;
                        if (content.Length == 0)
                        {
                            _logger.LogWarning("The following image does not exist: " + url + " feature: " + feature.GetId());
                            continue;
                        }
                        var image = Image.Load(content, out var format);
                        if (!needResize)
                        {
                            items.Add(new ImageItem { ImageUrl = url, Data = $"data:image/{format};base64," + Convert.ToBase64String(content) });
                        }
                        else
                        {
                            content = ResizeImage(image, size);
                            items.Add(new ImageItem { ImageUrl = url, Data = $"data:image/jpeg;base64," + Convert.ToBase64String(content) });
                        }
                    }
                    catch (Exception)
                    {
                        _logger.LogWarning("The following image is not an image: " + url + " feature: " + feature.GetId());
                    }
                }
            });

            var list = items.ToList();
            var index = 0;
            while (list.Count > 0)
            {
                var imageItemsString = JsonConvert.SerializeObject(list.Take(1000).ToList(), new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver()
                });
                //_fileSystemHelper.WriteAllText($"images{index.ToString("000")}.json", imageItemsString);
                var newEntry = new ZipEntry($"images/images{ index.ToString("000") }.json")
                {
                    DateTime = DateTime.Now
                };
                zipStream.PutNextEntry(newEntry);
                StreamUtils.Copy(new MemoryStream(Encoding.UTF8.GetBytes(imageItemsString)), zipStream, new byte[4096]);
                zipStream.CloseEntry();
                list = list.Skip(1000).ToList();
                index++;
            }
            _logger.LogInformation("Finished Image file creation: " + items.Count());
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
    }
}
