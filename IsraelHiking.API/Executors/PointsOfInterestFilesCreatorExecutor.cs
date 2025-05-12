using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Xml.Serialization;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class PointsOfInterestFilesCreatorExecutor : IPointsOfInterestFilesCreatorExecutor
{
    private readonly IFileSystemHelper _fileSystemHelper;
    private readonly IWebHostEnvironment _environment;
    private readonly ConfigurationData _options;
    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="fileSystemHelper"></param>
    /// <param name="environment"></param>
    /// <param name="options"></param>
    public PointsOfInterestFilesCreatorExecutor(IFileSystemHelper fileSystemHelper,
        IWebHostEnvironment environment,
        IOptions<ConfigurationData> options)
    {
        _fileSystemHelper = fileSystemHelper;
        _environment = environment;
        _options = options.Value;
    }

    /// <inheritdoc/>
    public void CreateSiteMapXmlFile(List<IFeature> features)
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
            url = list.Concat([
                new tUrl {
                loc = "https://israelhiking.osm.org.il/",
                lastmod =  DateTime.Now.ToUniversalTime().ToString("o")
            }
            ]).ToArray()
        };
        var serializer = new XmlSerializer(typeof(urlset));
        serializer.Serialize(fileStream, siteMap);
    }

    /// <inheritdoc/>
    public void CreateExtenalPoisFile(List<IFeature> features)
    {
        var fullFolderPath = Path.GetFullPath(_options.ExternalFilesFolder);
        var externalFeatures = new FeatureCollection();
        foreach (var feature in features.Where(f => f.Attributes[FeatureAttributes.POI_SOURCE].ToString() != Sources.OSM).ToList()) {
            externalFeatures.Add(feature);
        }
        _fileSystemHelper.WriteAllBytes(Path.Combine(fullFolderPath, "external.geojson"), externalFeatures.ToBytes());
    }
}