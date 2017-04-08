using IsraelHiking.API;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.DataAccess;
using Microsoft.Extensions.CommandLineUtils;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using NLog.Config;
using NLog.Extensions.Logging;
using System;
using System.IO;
using System.Threading.Tasks;

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
            CommandLineApplication commandLineApplication = new CommandLineApplication(throwOnUnexpectedArg: false);
            CommandOption download = commandLineApplication.Option(
              "-d | --download", "Download OSM file from geofabrik or uses a local one.",
              CommandOptionType.NoValue);
            CommandOption graphHopper = commandLineApplication.Option(
              "-g | --graphhopper", "Update graphhopper routing data.",
              CommandOptionType.NoValue);
            CommandOption elasticSearch = commandLineApplication.Option(
              "-e | -es | --elasticsearch", "Update elastic search data.",
              CommandOptionType.NoValue);
            commandLineApplication.HelpOption("-? | -h | --help");
            var operations = OsmDataServiceOperations.None;
            commandLineApplication.OnExecute(() =>
            {
                if (download.HasValue())
                {
                    operations |= OsmDataServiceOperations.GetOsmFile;
                }
                if (elasticSearch.HasValue())
                {
                    operations |= OsmDataServiceOperations.UpdateElasticSearch;
                }
                if (graphHopper.HasValue())
                {
                    operations |= OsmDataServiceOperations.UpdateGraphHopper;
                }
                if (download.HasValue() == false && elasticSearch.HasValue() == false && graphHopper.HasValue() == false)
                {
                    // default for empty commandline is to do all.
                    operations = OsmDataServiceOperations.All;
                }
                return 0;
            });
            commandLineApplication.Execute(args);
            return operations;
        }

        private static ILoggerFactory GetNLogFactory(IFileProvider fileProvider)
        {
            NLog.LogManager.Configuration = new XmlLoggingConfiguration(fileProvider.GetFileInfo("IsraelHiking.Updater.nlog").PhysicalPath, true);
            ILoggerFactory loggerFactory = new LoggerFactory();
            loggerFactory.AddNLog();
            return loggerFactory;
        }

        private static async Task Run(OsmDataServiceOperations operations)
        {
            ILogger logger = null;
            try
            {
                var location = System.Reflection.Assembly.GetEntryAssembly().Location;
                var directory = Path.GetDirectoryName(location);
                var fileProvider = new PhysicalFileProvider(directory);
                var loggerFactory = GetNLogFactory(fileProvider);
                var config = new ConfigurationBuilder().Build();
                var container = new ServiceCollection()
                    .AddIHMDataAccess()
                    .AddIHMApi()
                    .AddSingleton(provider => loggerFactory.CreateLogger("Updater"))
                    .AddSingleton<IFileProvider, PhysicalFileProvider>((serviceProvider) => fileProvider)
                    .AddSingleton((serviceProvider) => fileProvider)
                    .AddOptions()
                    .BuildServiceProvider();
                var osmDataService = container.GetRequiredService<IOsmDataService>();
                logger = container.GetRequiredService<ILogger>();

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
