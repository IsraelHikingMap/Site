using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Osm;
using OsmSharp.Osm.PBF.Streams;
using OsmSharp.Osm.Streams.Complete;

namespace IsraelHiking.DataAccess.Osm
{
    public class OsmRepository : IOsmRepository
    {
        private const string NAME = "name";

        private readonly ILogger _logger;
        private readonly IFileSystemHelper _fileSystemHelper;

        public OsmRepository(ILogger logger, IFileSystemHelper fileSystemHelper)
        {
            _logger = logger;
            _fileSystemHelper = fileSystemHelper;
        }

        public Task<Dictionary<string, List<ICompleteOsmGeo>>> GetElementsWithName(string osmFilePath)
        {
            return Task.Run(() =>
            {
                using (var stream = _fileSystemHelper.FileOpenRead(osmFilePath))
                {
                    _logger.LogInformation($"Reading {osmFilePath} to memory - extracting only elements with name.");
                    var source = new PBFOsmStreamSource(stream);
                    var completeSource = new OsmSimpleCompleteStreamSource(source);
                    var namesDictionary = completeSource
                        .Where(o => string.IsNullOrWhiteSpace(GetName(o)) == false)
                        .GroupBy(GetName)
                        .ToDictionary(g => g.Key, g => g.ToList());
                    _logger.LogInformation("Finished grouping data by name.");
                    return namesDictionary;
                }
            });
        }

        public Task<List<CompleteWay>> GetAllHighways(string osmFilePath)
        {
            return Task.Run(() =>
            {
                using (var stream = _fileSystemHelper.FileOpenRead(osmFilePath))
                {
                    _logger.LogInformation($"Reading {osmFilePath} to memory - extracting only highways.");
                    var source = new PBFOsmStreamSource(stream);
                    var completeSource = new OsmSimpleCompleteStreamSource(source);
                    var higways = completeSource
                        .OfType<CompleteWay>()
                        .Where(o => o.Tags.ContainsKey("highway"))
                        .ToList();
                    _logger.LogInformation("Finished getting highways. " + higways.Count);
                    return higways;
                }
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
    }
}
