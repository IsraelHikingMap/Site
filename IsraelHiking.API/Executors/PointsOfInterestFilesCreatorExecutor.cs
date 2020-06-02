using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using SixLabors.ImageSharp;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Serialization;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class PointsOfInterestFilesCreatorExecutor : IPointsOfInterestFilesCreatorExecutor
    {
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IWebHostEnvironment _environment;
        private readonly IImagesRepository _imagesRepository;
        private readonly ILogger _logger;
        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="environment"></param>
        /// <param name="imagesRepository"></param>
        /// <param name="logger"></param>
        public PointsOfInterestFilesCreatorExecutor(IFileSystemHelper fileSystemHelper,
            IWebHostEnvironment environment,
            IImagesRepository imagesRepository,
            ILogger logger)
        {
            _fileSystemHelper = fileSystemHelper;
            _environment = environment;
            _imagesRepository = imagesRepository;
            _logger = logger;
        }

        /// <inheritdoc/>
        public void CreateSiteMapXmlFile(List<Feature> features)
        {
            using var fileStream = _fileSystemHelper.CreateWriteStream(Path.Combine(_environment.WebRootPath, "sitemap.xml"));
            var list = features.Select(feature =>
            {
                var dateString = feature.Attributes.Exists(FeatureAttributes.POI_LAST_MODIFIED)
                ? DateTime.Parse(feature.Attributes[FeatureAttributes.POI_LAST_MODIFIED].ToString()).ToUniversalTime().ToString("o")
                : DateTime.Now.ToUniversalTime().ToString("o");
                return new tUrl
                {
                    lastmod = dateString,
                    loc = "https://israelhiking.osm.org.il/poi/" + feature.Attributes[FeatureAttributes.POI_SOURCE] + "/" + feature.Attributes[FeatureAttributes.ID],
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

        /// <inheritdoc/>
        public void CreateOfflineImagesFile(List<Feature> features)
        {
            using var outputMemStream = new MemoryStream();
            using var zipStream = new ZipOutputStream(outputMemStream);
            zipStream.SetLevel(9);
            var items = new ConcurrentBag<ImageItem>();
            var downloadedUrls = _imagesRepository.GetAllUrls().Result.ToHashSet();
            _logger.LogInformation($"Staring Image file creation: {features.Count} features, exiting images: {downloadedUrls.Count}");
            Parallel.ForEach(features, new ParallelOptions { MaxDegreeOfParallelism = 10 }, (feature) =>
            {
                var urls = feature.Attributes.GetNames()
                    .Where(n => n.StartsWith(FeatureAttributes.IMAGE_URL)).Select(n => feature.Attributes[n].ToString())
                    .Where(u => !string.IsNullOrWhiteSpace(u));
                foreach (var url in urls)
                {
                    if (!downloadedUrls.Contains(url))
                    {
                        _logger.LogWarning("The following image does not exist in database: " + url + " feature: " + feature.GetId());
                        continue;
                    }
                    items.Add(_imagesRepository.GetImageByUrl(url).Result);
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
                var newEntry = new ZipEntry($"images/images{index:000}.json")
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
            zipStream.Finish();
            outputMemStream.Position = 0;

            _fileSystemHelper.WriteAllBytes("images.ihm", outputMemStream.ToArray());
        }
    }
}
