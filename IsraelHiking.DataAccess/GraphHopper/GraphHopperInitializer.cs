using System;
using System.IO;
using System.Linq;
using System.Reflection;
using System.ServiceProcess;
using System.Threading;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.GraphHopper
{
    public class GraphHopperInitializer
    {
        private readonly ILogger _logger;
        private readonly IProcessHelper _processHelper;
        private const string GRAPH_HOPPER_ROUTING_SERVICE_NAME = "\"Graph Hopper Routing\"";
        private const string NSSM_EXE = "nssm.exe";
        private readonly string _workingDirectory;

        public GraphHopperInitializer(ILogger logger, IProcessHelper processHelper)
        {
            _logger = logger;
            _processHelper = processHelper;
            var assemblyPath = Path.GetDirectoryName(Assembly.GetAssembly(typeof (GraphHopperInitializer)).Location) ?? string.Empty;
            _workingDirectory = Path.Combine(assemblyPath, "GraphHopper");
            if (string.IsNullOrEmpty(_workingDirectory))
            {
                _logger.Error("Unable to set working directory from assembly path!");
            }
        }

        public void InstallServiceIfNeeded()
        {
            var serviceController = GetService();
            if (serviceController != null && serviceController.Status == ServiceControllerStatus.Running)
            {
                return;
            }
            UninstallService();
            InstallService();
        }

        private void InstallService()
        {
            _logger.Info($"Adding {GRAPH_HOPPER_ROUTING_SERVICE_NAME} service to windows...");
            var installArguments = $"install {GRAPH_HOPPER_ROUTING_SERVICE_NAME} java -cp \"*;web\\*\" com.graphhopper.http.GHServer config=config-example.properties graph.location=israel-and-palestine-latest.osm-gh osmreader.osm=israel-and-palestine-latest.osm.pbf jetty.port=8989";
            _processHelper.Start(NSSM_EXE, installArguments, _workingDirectory);
            _processHelper.Start(NSSM_EXE, $"set {GRAPH_HOPPER_ROUTING_SERVICE_NAME} AppDirectory \"{_workingDirectory}\"", _workingDirectory);
            _processHelper.Start(NSSM_EXE, $"set {GRAPH_HOPPER_ROUTING_SERVICE_NAME} Description \"A routing service for israel hiking site\"", _workingDirectory);
            _processHelper.Start(NSSM_EXE, $"start {GRAPH_HOPPER_ROUTING_SERVICE_NAME}", _workingDirectory);
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
            _processHelper.Start(NSSM_EXE, $"stop {GRAPH_HOPPER_ROUTING_SERVICE_NAME}", _workingDirectory);
            _processHelper.Start(NSSM_EXE, $"remove {GRAPH_HOPPER_ROUTING_SERVICE_NAME} confirm", _workingDirectory);
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
    }
}
