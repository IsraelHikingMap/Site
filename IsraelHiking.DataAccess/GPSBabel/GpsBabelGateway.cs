using System.IO;
using System.Threading.Tasks;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.GPSBabel
{
    public class GpsBabelGateway : IGpsBabelGateway
    {
        private readonly ILogger _logger;
        private readonly IProcessHelper _processHelper;
        private readonly IConfigurationProvider _configurationProvider;
        private const string GPS_BABEL_EXE = "gpsbabel.exe";
        private const string GPSBABEL_DIRECTORY = "GPSBabel";

        public GpsBabelGateway(ILogger logger, IProcessHelper processHelper, IConfigurationProvider configurationProvider)
        {
            _logger = logger;
            _processHelper = processHelper;
            _configurationProvider = configurationProvider;
        }

        public Task<byte[]> ConvertFileFromat(byte[] content, string inputFormat, string outputFormat)
        {
            return Task.Run(() =>
            {
                if (inputFormat == outputFormat)
                {
                    return content;
                }
                var inputTempfileName = Path.GetTempFileName();
                // file names are created to overcome utf-8 issues in file name.
                var outputTempfileName = Path.GetTempFileName();
                File.WriteAllBytes(inputTempfileName, content);
                var workingDirectory = Path.Combine(_configurationProvider.BinariesFolder, GPSBABEL_DIRECTORY);
                var arguments = "-N -i " + inputFormat + " -f \"" + inputTempfileName + "\" -o " + outputFormat + " -F \"" +
                                outputTempfileName + "\"";
                _processHelper.Start(GPS_BABEL_EXE, arguments, workingDirectory);
                File.Delete(inputTempfileName);
                var outputContent = File.ReadAllBytes(outputTempfileName);
                File.Delete(outputTempfileName);
                _logger.LogDebug("Finished converting data from: " + inputFormat + " to: " + outputFormat);
                return outputContent;
            });
        }
    }
}
