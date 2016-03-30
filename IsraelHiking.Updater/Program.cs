using System;
using System.IO;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.DataAccess;
using IsraelHiking.DataAccess.ElasticSearch;
using IsraelHiking.DataAccess.GraphHopper;

namespace IsraelHiking.Updater
{
    class Program
    {
        static void Main(string[] args)
        {
            OsmDataService.Operations operations = GetOperationsFromAgruments(args);
            if (operations == OsmDataService.Operations.None)
            {
                return;
            }
            Run(operations).Wait();
        }

        private static OsmDataService.Operations GetOperationsFromAgruments(string[] args)
        {
            var options = new CommandLineOptions();
            if (!CommandLine.Parser.Default.ParseArguments(args, options))
            {
                return OsmDataService.Operations.None;
            }
            var operations = OsmDataService.Operations.All;
            if (options.DontGetOsmFile)
            {
                operations &= ~OsmDataService.Operations.GetOsmFile;
            }
            if (options.DontUpdateElasticSearch)
            {
                operations &= ~OsmDataService.Operations.UpdateElasticSearch;
            }
            if (options.DontUpdateGraphHopper)
            {
                operations &= ~OsmDataService.Operations.UpdateGraphHopper;
            }
            return operations;
        }

        private static async Task Run(OsmDataService.Operations operations)
        {
            var logger = new ConsoleLogger();
            var helperProcess = new ProcessHelper(logger);
            var graphHopperHelper = new GraphHopperHelper(logger, helperProcess);
            var elasticSearchGateway = new ElasticSearchGateway(logger);
            var elasticSearchHelper = new ElasticSearchHelper(logger, helperProcess);
            var osmDataService = new OsmDataService(graphHopperHelper, new RemoteFileFetcherGateway(logger), new FileSystemHelper(), elasticSearchGateway, elasticSearchHelper, logger);
            var directory = Directory.GetCurrentDirectory();
            try
            {
                await osmDataService.Initialize(directory);
                await osmDataService.UpdateData(operations);
            }
            catch (Exception ex)
            {
                logger.Error("Failed updating OSM data with exception: " + ex);
            }
        }
    }
}
