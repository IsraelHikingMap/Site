using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.ServiceProcess;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.GraphHopper
{
    public class GraphHopperHelper : IGraphHopperHelper
    {
        private const string PBF_FILE_NAME = "israel-and-palestine-latest.osm.pbf";
        private const string GH_NEW_CACHE_FOLDER = "israel-and-palestine-latest.osm-gh-new";
        private const string GRAPH_HOPPER_ROUTING_SERVICE_NAME = "\"Graph Hopper Routing\"";
        private const string NSSM_EXE = "nssm.exe";

        private readonly ILogger _logger;
        private readonly IProcessHelper _processHelper;

        public string WorkingDirectory { get; private set; }

        public GraphHopperHelper(ILogger logger, IProcessHelper processHelper)
        {
            _logger = logger;
            _processHelper = processHelper;
            var assemblyPath = Path.GetDirectoryName(Assembly.GetAssembly(typeof(GraphHopperHelper)).Location) ?? string.Empty;
            WorkingDirectory = Path.Combine(assemblyPath, "GraphHopper");
            if (string.IsNullOrEmpty(WorkingDirectory))
            {
                _logger.Error("Unable to set working directory from assembly path!");
            }
        }

        public Task Initialize(string serverPath)
        {
            return Task.Run(() =>
            {
                WorkingDirectory = Path.Combine(serverPath, "GraphHopper");
                var serviceController = GetService();
                if (serviceController != null && serviceController.Status == ServiceControllerStatus.Running)
                {
                    return;
                }
                UninstallService();
                InstallService();
            });
        }

        private void InstallService()
        {
            _logger.Info($"Adding {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service to windows...");
            var installArguments = $"install {GRAPH_HOPPER_ROUTING_SERVICE_NAME} java -cp \"*;web\\*\" com.graphhopper.http.GHServer config=config-example.properties graph.location=israel-and-palestine-latest.osm-gh osmreader.osm=israel-and-palestine-latest.osm.pbf jetty.port=8989";
            _processHelper.Start(NSSM_EXE, installArguments, WorkingDirectory);
            _processHelper.Start(NSSM_EXE, $"set {GRAPH_HOPPER_ROUTING_SERVICE_NAME} AppDirectory \"{WorkingDirectory}\"", WorkingDirectory);
            _processHelper.Start(NSSM_EXE, $"set {GRAPH_HOPPER_ROUTING_SERVICE_NAME} Description \"A routing service for israel hiking site\"", WorkingDirectory);
            _processHelper.Start(NSSM_EXE, $"start {GRAPH_HOPPER_ROUTING_SERVICE_NAME}", WorkingDirectory);
            Task.Delay(new TimeSpan(0, 0, 0, 3)).Wait();
            var serviceController = GetService();
            if (serviceController == null || serviceController.Status != ServiceControllerStatus.Running)
            {
                _logger.Error($"Unable to add {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service to windows...");
            }
            else
            {
                _logger.Info($"Added {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service to windows...");
            }
        }

        private void UninstallService()
        {
            _logger.Info($"Removeing {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service from windows...");
            _processHelper.Start(NSSM_EXE, $"stop {GRAPH_HOPPER_ROUTING_SERVICE_NAME}", WorkingDirectory);
            _processHelper.Start(NSSM_EXE, $"remove {GRAPH_HOPPER_ROUTING_SERVICE_NAME} confirm", WorkingDirectory);
            Task.Delay(new TimeSpan(0, 0, 0, 3)).Wait();
            if (GetService() != null)
            {
                _logger.Error($"Unable to remove {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service to windows...");
            }
            else
            {
                _logger.Info($"Removed {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service to windows...");
            }
        }

        private ServiceController GetService()
        {
            return ServiceController.GetServices().FirstOrDefault(s => s.DisplayName == GRAPH_HOPPER_ROUTING_SERVICE_NAME.Replace("\"", string.Empty));
        }

        public async Task UpdateData()
        {
            await GetLatestOsmData();
            var currentDirectory = Path.Combine(WorkingDirectory, "israel-and-palestine-latest.osm-gh");
            var oldDirectory = Path.Combine(WorkingDirectory, "israel-and-palestine-latest.osm-gh-old");
            var newDirectory = Path.Combine(WorkingDirectory, GH_NEW_CACHE_FOLDER);
            DeleteDirectories();

            _logger.Info("Creating graph hopper cache based on latest pbf file");
            _processHelper.Start("cmd", $"/c java -cp \"*\" com.graphhopper.tools.Import config=config-example.properties osmreader.osm={PBF_FILE_NAME} graph.location={GH_NEW_CACHE_FOLDER} > UpdateCache.log", WorkingDirectory, 30 * 60 * 1000);

            _processHelper.Start(NSSM_EXE, $"stop {GRAPH_HOPPER_ROUTING_SERVICE_NAME}", WorkingDirectory);
            try
            {
                if (Directory.Exists(newDirectory))
                {
                    if (Directory.Exists(currentDirectory))
                    {
                        _logger.Info($"moving {currentDirectory} to {oldDirectory}");
                        Directory.Move(currentDirectory, oldDirectory);
                    }
                    _logger.Info($"moving {newDirectory} to {currentDirectory}");
                    Directory.Move(newDirectory, currentDirectory);
                }
                DeleteDirectories();
            }
            finally
            {
                _processHelper.Start(NSSM_EXE, $"start {GRAPH_HOPPER_ROUTING_SERVICE_NAME}", WorkingDirectory);
            }
        }

        private async Task GetLatestOsmData()
        {
            using (var httpClient = new HttpClient { Timeout = new TimeSpan(0, 0, 30, 0) })
            {
                var address = "http://download.geofabrik.de/asia/" + PBF_FILE_NAME;
                _logger.Info("Fetching " + address);
                var content = await httpClient.GetAsync(address).ConfigureAwait(false);
                var fileFullPath = Path.Combine(WorkingDirectory, PBF_FILE_NAME);
                if (File.Exists(fileFullPath))
                {
                    _logger.Info("Deleting " + fileFullPath);
                    File.Delete(fileFullPath);
                }
                var fileContent = await content.Content.ReadAsByteArrayAsync().ConfigureAwait(false);
                _logger.Info("Saving new content to " + fileFullPath);
                File.WriteAllBytes(fileFullPath, fileContent);
                _logger.Debug("done");
            }
        }

        private void DeleteDirectories()
        {
            var oldDirectory = Path.Combine(WorkingDirectory, "israel-and-palestine-latest.osm-gh-old");
            var newDirectory = Path.Combine(WorkingDirectory, GH_NEW_CACHE_FOLDER);
            foreach (var directory in new[] { oldDirectory, newDirectory }.Where(Directory.Exists))
            {
                _logger.Info("Deleting " + directory);
                try
                {
                    Directory.Delete(directory, true);
                }
                catch (Exception ex)
                {
                    _logger.Error($"Unable to delete {directory} {ex}");
                }
            }
        }
    }
}
