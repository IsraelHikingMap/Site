using CommandLine;
using CommandLine.Text;

namespace IsraelHiking.Updater
{
    public class CommandLineOptions
    {
        [Option('d', "no-download", DefaultValue = false,
        HelpText = "Download OSM file from geofabrik.")]
        public bool DontGetOsmFile { get; set; }

        [Option('e', "no-es-update", DefaultValue = false,
        HelpText = "Update Elastic Search database.")]
        public bool DontUpdateElasticSearch { get; set; }

        [Option('g', "no-gh-update", DefaultValue = false,
        HelpText = "Update GraphHopper route service.")]
        public bool DontUpdateGraphHopper { get; set; }

        [HelpOption]
        public string GetUsage()
        {
            return HelpText.AutoBuild(this, current => HelpText.DefaultParsingErrorsHandler(this, current));
        }
    }
}
