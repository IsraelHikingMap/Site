using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Complete;
using OsmSharp.Streams;
using OsmSharp.Streams.Complete;
using Microsoft.Extensions.Logging;
using System.IO;
using OsmSharp;

namespace IsraelHiking.DataAccess.OpenStreetMap
{
    public class OsmRepository : IOsmRepository
    {
        private const string NAME = "name";

        private readonly ILogger _logger;

        public OsmRepository(ILogger logger)
        {
            _logger = logger;
        }

        public Task<Dictionary<string, List<ICompleteOsmGeo>>> GetElementsWithName(Stream osmFileStream)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation($"Extracting elements with name from OSM stream.");
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var namesDictionary = completeSource
                    .Where(o => string.IsNullOrWhiteSpace(GetName(o)) == false)
                    .GroupBy(GetName)
                    .ToDictionary(g => g.Key, g => g.ToList());
                _logger.LogInformation("Finished grouping data by name. " + namesDictionary.Values.Count);
                return namesDictionary;
            });
        }

        public Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation($"Extracting highways from OSM stream.");
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var higways = completeSource
                    .OfType<CompleteWay>()
                    .Where(o => o.Tags.ContainsKey("highway"))
                    .ToList();
                _logger.LogInformation("Finished getting highways. " + higways.Count);
                return higways;
            });
        }

        private string GetName(ICompleteOsmGeo osm)
        {
            if (osm.Tags.ContainsKey(NAME))
            {
                return osm.Tags[NAME];
            }
            foreach (var tag in osm.Tags)
            {
                if (tag.Key.Contains(NAME))
                {
                    return tag.Value;
                }
            }
            return string.Empty;
        }

        public Task<List<Node>> GetPointsWithNoNameByTags(Stream osmFileStream, List<KeyValuePair<string, string>> tags)
        {
            return Task.Run(() =>
            {
                _logger.LogInformation($"Extracting nodes by tags from OSM stream.");
                var source = new PBFOsmStreamSource(osmFileStream);
                var completeSource = new OsmSimpleCompleteStreamSource(source);
                var nodes = completeSource
                    .OfType<Node>()
                    .Where(node =>
                        GetName(node) == string.Empty &&
                        tags.Any(t => node.Tags.ContainsKey(t.Key) &&
                        node.Tags[t.Key].Equals(t.Value))
                    )
                    .ToList();
                _logger.LogInformation("Finished getting nodes by tags. " + nodes.Count);
                return nodes;
            });
        }
    }
}
