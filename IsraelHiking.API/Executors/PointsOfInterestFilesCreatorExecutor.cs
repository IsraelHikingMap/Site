using ICSharpCode.SharpZipLib.Core;
using ICSharpCode.SharpZipLib.Zip;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
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
        public void Create(List<Feature> features)
        {
            _logger.LogInformation($"Starting points of interest files creation: {features.Count}.");
            CreateSitemapXmlFile(features);
            CreateOfflinePoisFile(features);
            _logger.LogInformation($"Finished points of interest files creation: {features.Count}.");
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
            var slimCollection = new FeatureCollection();
            foreach (var feature in features)
            {
                var geoLocation = feature.Attributes[FeatureAttributes.POI_GEOLOCATION] as AttributesTable;

                var slimFeature = new Feature(new Point(
                    double.Parse(geoLocation[FeatureAttributes.LON].ToString()),
                    double.Parse(geoLocation[FeatureAttributes.LAT].ToString())), new AttributesTable());
                foreach (var property in new[] {
                        FeatureAttributes.POI_ICON,
                        FeatureAttributes.POI_NAMES,
                        FeatureAttributes.POI_ID,
                        FeatureAttributes.POI_CATEGORY,
                        FeatureAttributes.ID,
                        FeatureAttributes.POI_ICON_COLOR,
                        FeatureAttributes.POI_SOURCE,
                        FeatureAttributes.POI_LANGUAGE
                        })
                {
                    slimFeature.Attributes.AddOrUpdate(property, feature.Attributes[property]);
                }
                slimFeature.Attributes.AddOrUpdate(FeatureAttributes.POI_HAS_EXTRA_DATA, Languages.Array.ToDictionary(l => l, l => feature.HasExtraData(l)));
                slimCollection.Add(slimFeature);
                collection.Add(feature);
            }
            using (var fileStream = _fileSystemHelper.CreateWriteStream(Path.Combine(_environment.WebRootPath, "pois-slim.geojson")))
            {
                fileStream.Write(slimCollection.ToBytes());
            }

            using (var outputMemStream = new MemoryStream())
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

                CreateImagesJsonFiles(features, zipStream);
                zipStream.Finish();
                outputMemStream.Position = 0;

                _fileSystemHelper.WriteAllBytes("pois.ihm", outputMemStream.ToArray());
            }
        }

        private void CreateImagesJsonFiles(List<Feature> features, ZipOutputStream zipStream)
        {
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
        }
    }
}
