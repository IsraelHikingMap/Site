using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
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
        private readonly ConfigurationData _options;
        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="environment"></param>
        /// <param name="imagesRepository"></param>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public PointsOfInterestFilesCreatorExecutor(IFileSystemHelper fileSystemHelper,
            IWebHostEnvironment environment,
            IImagesRepository imagesRepository,
            IOptions<ConfigurationData> options,
            ILogger logger)
        {
            _fileSystemHelper = fileSystemHelper;
            _environment = environment;
            _imagesRepository = imagesRepository;
            _options = options.Value;
            _logger = logger;
        }

        /// <inheritdoc/>
        public void CreateSiteMapXmlFile(List<Feature> features)
        {
            using var fileStream = _fileSystemHelper.CreateWriteStream(Path.Combine(_environment.WebRootPath, "sitemap.xml"));
            var list = features.Where(f => Languages.Array.Any(l => f.IsProperPoi(l))).Select(feature =>
            {
                return new tUrl
                {
                    lastmod = feature.GetLastModified().ToUniversalTime().ToString("o"),
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
        public void CreateOfflinePoisFile(List<Feature> features)
        {
            using var outputMemStream = new MemoryStream();
            using var zipStream = new ZipOutputStream(outputMemStream);
            zipStream.SetLevel(9);
            var featuresList = features.ToList();
            var index = 0;
            var chunkSize = 1000;
            while (featuresList.Count > 0)
            {
                var collection = new FeatureCollection();
                foreach (var feature in featuresList.Take(chunkSize))
                {
                    collection.Add(feature);
                }
                zipStream.PutNextEntry(new ZipEntry($"pois/pois{index:000}.geojson") { DateTime = DateTime.Now });
                StreamUtils.Copy(new MemoryStream(collection.ToBytes()), zipStream, new byte[4096]);
                zipStream.CloseEntry();
                featuresList = featuresList.Skip(chunkSize).ToList();
                index++;
            }

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
                    var item = _imagesRepository.GetImageByUrl(url).Result;
                    if (item == null)
                    {
                        _logger.LogWarning("The following image exist in database but was not returned by GetImageByUrl: " + url);
                        continue;
                    }
                    items.Add(item);
                }
            });

            var list = items.ToList();
            index = 0;
            chunkSize = 200;
            while (list.Count > 0)
            {
                var imageItemsString = JsonConvert.SerializeObject(list.Take(chunkSize).ToList(), new JsonSerializerSettings
                {
                    ContractResolver = new CamelCasePropertyNamesContractResolver()
                });
                zipStream.PutNextEntry(new ZipEntry($"images/images{index:000}.json") { DateTime = DateTime.Now });
                StreamUtils.Copy(new MemoryStream(Encoding.UTF8.GetBytes(imageItemsString)), zipStream, new byte[4096]);
                zipStream.CloseEntry();
                list = list.Skip(chunkSize).ToList();
                index++;
            }
            _logger.LogInformation("Finished Image file creation: " + items.Count());
            zipStream.Finish();
            outputMemStream.Position = 0;
            var fullFolderPath = Path.GetFullPath(_options.OfflineFilesFolder);
            _fileSystemHelper.WriteAllBytes(Path.Combine(fullFolderPath, "pois.zip"), outputMemStream.ToArray());
        }
    }
}
