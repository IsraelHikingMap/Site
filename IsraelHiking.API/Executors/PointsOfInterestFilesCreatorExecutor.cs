using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml.Serialization;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc/>
    public class PointsOfInterestFilesCreatorExecutor : IPointsOfInterestFilesCreatorExecutor
    {
        private readonly IFileSystemHelper _fileSystemHelper;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger _logger;
        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="fileSystemHelper"></param>
        /// <param name="environment"></param>
        /// <param name="logger"></param>
        public PointsOfInterestFilesCreatorExecutor(IFileSystemHelper fileSystemHelper,
            IWebHostEnvironment environment,
            ILogger logger)
        {
            _fileSystemHelper = fileSystemHelper;
            _environment = environment;
            _logger = logger;
        }

        /// <inheritdoc/>
        public void Create(List<Feature> features)
        {
            _logger.LogInformation($"Starting points of interterest files creation: {features.Count}.");
            CreateSitemapXmlFile(features);
            CreateJsonFile(features);
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

        private void CreateJsonFile(List<Feature> features)
        {
            var collection = new FeatureCollection();
            foreach (var feature in features)
            {
                collection.Add(feature);
            }
            _fileSystemHelper.WriteAllBytes("pois.geojson", collection.ToBytes());
        }
    }
}
