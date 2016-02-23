using IsraelHiking.DataAccessInterfaces;
using System.Configuration;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class GpsBabelGateway : IGpsBabelGateway
    {
        private readonly ILogger _logger;
        private readonly IProcessHelper _processHelper;
        private const string GPS_BABEL_EXE = "gpsbabel.exe";
        private const string GPS_DIRECTORY_KEY = "gpsbabel";

        public GpsBabelGateway(ILogger logger, IProcessHelper processHelper)
        {
            _logger = logger;
            _processHelper = processHelper;
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
                var workingDirectory = ConfigurationManager.AppSettings[GPS_DIRECTORY_KEY];
                var arguments = "-N -i " + inputFormat + " -f \"" + inputTempfileName + "\" -o " + outputFormat + " -F \"" +
                                outputTempfileName + "\"";
                _processHelper.Start(GPS_BABEL_EXE, arguments, workingDirectory);
                File.Delete(inputTempfileName);
                var outputContent = File.ReadAllBytes(outputTempfileName);
                File.Delete(outputTempfileName);
                _logger.Debug("Finished converting data from: " + inputFormat + " to: " + outputFormat);
                return outputContent;
            });
        }
    }
}
