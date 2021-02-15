using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using OsmSharp.Complete;
using OsmSharp.Streams;
using OsmSharp.Streams.Complete;
using Microsoft.Extensions.Logging;
using System.IO;
using IsraelHiking.Common.Extensions;
using OsmSharp;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces.Repositories;

namespace IsraelHiking.DataAccess
{
    public class OsmRepository : IOsmRepository
    {
        private readonly ILogger _logger;

        public OsmRepository(ILogger logger)
        {
            _logger = logger;
        }

        public Task<List<ICompleteOsmGeo>> GetElementsWithName(Stream osmFileStream)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation("Starting extracting elements with name from OSM stream.");
                osmFileStream.Seek(0, SeekOrigin.Begin);
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var elements = completeSource
                    .Where(o => !o.Tags.Contains("highway", "construction"))
                    .Where(o => string.IsNullOrWhiteSpace(o.Tags.GetName()) == false)
                    .ToList();
                _logger.LogInformation("Finished extracting elements with name: " + elements.Count);
                return elements;
            });
        }

        public Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation("Extracting highways from OSM stream.");
                osmFileStream.Seek(0, SeekOrigin.Begin);
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var higways = completeSource
                    .OfType<CompleteWay>()
                    .Where(o => o.Tags.ContainsKey("highway") && !o.Tags.Contains("highway", "construction"))
                    .ToList();
                _logger.LogInformation("Finished getting highways. " + higways.Count);
                return higways;
            });
        }

        public Task<List<Node>> GetPointsWithNoNameByTags(Stream osmFileStream, List<KeyValuePair<string, string>> tags)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation("Extracting nodes by tags from OSM stream.");
                osmFileStream.Seek(0, SeekOrigin.Begin);
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var nodes = completeSource
                    .OfType<Node>()
                    .Where(node =>
                        node.Tags.GetName() == string.Empty &&
                        node.Tags.HasAny(tags))
                    .ToList();
                _logger.LogInformation("Finished getting nodes by tags. " + nodes.Count);
                return nodes;
            });
        }

        public Task<List<string>> GetImagesUrls(Stream osmFileStream)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation("Starting extracting urls from OSM stream.");
                osmFileStream.Seek(0, SeekOrigin.Begin);
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var urls = completeSource.Where(element => element.Tags.Any(t => t.Key.StartsWith(FeatureAttributes.IMAGE_URL)))
                    .SelectMany(element => element.Tags.Where(t => t.Key.StartsWith(FeatureAttributes.IMAGE_URL)))
                    .Select(tag => tag.Value)
                    .ToList();
                _logger.LogInformation("Finished extracting urls from OSM stream. " + urls.Count);
                return urls;
            });
        }
    }
}
