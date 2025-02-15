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

public class OsmRepository : IOsmRepository
{
    private readonly ILogger _logger;

    public OsmRepository(ILogger logger)
    {
        _logger = logger;
    }

    public Task<List<CompleteWay>> GetAllHighways(Stream osmFileStream)
    {
        return Task.Run(() =>
        {
            _logger.LogInformation("Extracting highways from OSM stream.");
            osmFileStream.Seek(0, SeekOrigin.Begin);
            var source = new PBFOsmStreamSource(osmFileStream);
            var completeSource = new OsmSimpleCompleteStreamSource(source);
            var highways = completeSource
                .OfType<CompleteWay>()
                .Where(o => o.Tags.ContainsKey("highway") && !o.Tags.Contains("highway", "construction"))
                .ToList();
            _logger.LogInformation("Finished getting highways. " + highways.Count);
            return highways;
        });
    }

    public Task<Dictionary<string,List<string>>> GetExternalReferences(Stream osmFileStream)
    {
        return Task.Run(() =>
        {
            var dictionary = new Dictionary<string, List<string>>
            {
                { Sources.WIKIDATA, [] },
                { Sources.INATURE, [] }
            };
            _logger.LogInformation("Starting extracting external references from OSM stream.");
            osmFileStream.Seek(0, SeekOrigin.Begin);
            var source = new PBFOsmStreamSource(osmFileStream);
            var completeSource = new OsmSimpleCompleteStreamSource(source);
            var references = completeSource
                .Where(o => o.Tags.ContainsKey("wikidata") || o.Tags.ContainsKey("ref:IL:inature"))
                .ToList();
            foreach (var reference in references)
            {
                if (reference.Tags.ContainsKey("ref:IL:inature"))
                {
                    dictionary[Sources.INATURE].Add(reference.Tags["ref:IL:inature"]);
                }
                else
                {
                    dictionary[Sources.WIKIDATA].Add(reference.Tags["wikidata"]);
                }
            }
            _logger.LogInformation("Finished extracting external references from OSM stream: " + references.Count);
            return dictionary;
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