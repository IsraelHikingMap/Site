using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using OsmSharp.Complete;
using OsmSharp.Streams;
using OsmSharp.Streams.Complete;
using Microsoft.Extensions.Logging;
using System.IO;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;

namespace IsraelHiking.DataAccess;

public class OsmRepository(ILogger logger) : IOsmRepository
{
    public Task<List<string>> GetImagesUrls(Stream osmFileStream)
    {
        return Task.Run(() =>
        {
            logger.LogInformation("Starting extracting urls from OSM stream.");
            osmFileStream.Seek(0, SeekOrigin.Begin);
            var source = new PBFOsmStreamSource(osmFileStream);
            var completeSource = new OsmSimpleCompleteStreamSource(source);
            var urls = completeSource.Where(element => element.Tags.Any(t => t.Key.StartsWith(FeatureAttributes.IMAGE_URL)))
                .SelectMany(element => element.Tags.Where(t => t.Key.StartsWith(FeatureAttributes.IMAGE_URL)))
                .Select(tag => tag.Value)
                .ToList();
            logger.LogInformation("Finished extracting urls from OSM stream. " + urls.Count);
            return urls;
        });
    }
}