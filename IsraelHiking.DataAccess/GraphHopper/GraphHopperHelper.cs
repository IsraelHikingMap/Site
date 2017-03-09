using System;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.GraphHopper
{
    public class GraphHopperHelper : BaseNssmHelper, IGraphHopperHelper
    {
        private const string GH_NEW_CACHE_FOLDER = "israel-and-palestine-latest.osm-gh-new";
        private const string GH_OLD_CACHE_FOLDER = "israel-and-palestine-latest.osm-gh-old";
        private const string GRAPH_HOPPER_ROUTING_SERVICE_NAME = "\"Graph Hopper Routing Service\"";
        private const string GRAPHHOPPER = "GraphHopper";

        protected override string Name => GRAPH_HOPPER_ROUTING_SERVICE_NAME;
        protected override string Description => "A routing service for israel hiking site";
        protected override string CommandLine => "java -cp \"*;web\\*\" com.graphhopper.http.GHServer config=config-example.properties graph.location=israel-and-palestine-latest.osm-gh datareader.file=israel-and-palestine-latest.osm.pbf jetty.port=8989";
        protected override string RelativePath => GRAPHHOPPER;

        public GraphHopperHelper(ILogger logger, IProcessHelper processHelper) : base(logger, processHelper) { }

        public Task UpdateData(string osmFilePath)
        {
            return Task.Run(() =>
            {
                var currentDirectory = Path.Combine(WorkingDirectory, "israel-and-palestine-latest.osm-gh");
                var oldDirectory = Path.Combine(WorkingDirectory, GH_OLD_CACHE_FOLDER);
                var newDirectory = Path.Combine(WorkingDirectory, GH_NEW_CACHE_FOLDER);
                DeleteDirectories();

                Logger.LogInformation("Creating graph hopper cache based on latest pbf file");
                ProcessHelper.Start("cmd",
                    $"/c java -cp \"*\" com.graphhopper.tools.Import config=config-example.properties datareader.file={osmFilePath} graph.location={GH_NEW_CACHE_FOLDER} > UpdateCache.log",
                    WorkingDirectory, 30*60*1000);

                Stop();
                try
                {
                    if (Directory.Exists(newDirectory))
                    {
                        if (Directory.Exists(currentDirectory))
                        {
                            Logger.LogInformation($"moving {currentDirectory} to {oldDirectory}");
                            Directory.Move(currentDirectory, oldDirectory);
                        }
                        Logger.LogInformation($"moving {newDirectory} to {currentDirectory}");
                        Directory.Move(newDirectory, currentDirectory);
                    }
                    DeleteDirectories();
                }
                finally
                {
                    Start();
                }
            });
        }

        private void DeleteDirectories()
        {
            var oldDirectory = Path.Combine(WorkingDirectory, GH_OLD_CACHE_FOLDER);
            var newDirectory = Path.Combine(WorkingDirectory, GH_NEW_CACHE_FOLDER);
            foreach (var directory in new[] { oldDirectory, newDirectory }.Where(Directory.Exists))
            {
                Logger.LogInformation("Deleting " + directory);
                try
                {
                    Directory.Delete(directory, true);
                }
                catch (Exception ex)
                {
                    Logger.LogError($"Unable to delete {directory} {ex}");
                }
            }
        }
    }
}
