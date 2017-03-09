using System;
using System.Threading.Tasks;
using IsraelHiking.API;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Practices.Unity;

namespace IsraelHiking.Updater
{
    internal class Program
    {
        private static void Main(string[] args)
        {
            var operations = GetOperationsFromAgruments(args);
            if (operations == OsmDataServiceOperations.None)
            {
                return;
            }
            Run(operations).Wait();
        }

        private static OsmDataServiceOperations GetOperationsFromAgruments(string[] args)
        {
            var options = new CommandLineOptions();
            if (!CommandLine.Parser.Default.ParseArguments(args, options))
            {
                return OsmDataServiceOperations.None;
            }
            var operations = OsmDataServiceOperations.All;
            if (options.DontGetOsmFile)
            {
                operations &= ~OsmDataServiceOperations.GetOsmFile;
            }
            if (options.DontUpdateElasticSearch)
            {
                operations &= ~OsmDataServiceOperations.UpdateElasticSearch;
            }
            if (options.DontUpdateGraphHopper)
            {
                operations &= ~OsmDataServiceOperations.UpdateGraphHopper;
            }
            return operations;
        }

        private static async Task Run(OsmDataServiceOperations operations)
        {
            var logger = new ConsoleLogger();
            try
            {
                var container = new UnityContainer();
                UnityRegisterDataAccess.RegisterUnityTypes(container, logger);
                UnityRegisterApi.RegisterUnityTypes(container);
                var osmDataService = container.Resolve<IOsmDataService>();
                var fileSystemHelper = container.Resolve<IFileSystemHelper>();
                var directory = fileSystemHelper.GetCurrentDirectory();
                await osmDataService.Initialize(directory);
                await osmDataService.UpdateData(operations);
            }
            catch (Exception ex)
            {
                logger.LogError("Failed updating OSM data with exception: " + ex);
            }
        }
    }
}
