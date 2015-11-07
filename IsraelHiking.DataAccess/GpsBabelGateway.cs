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
        private const string GPS_BABEL_EXE = "gpsbabel.exe";
        private const string GPS_DIRECTORY_KEY = "gpsbabel";

        public GpsBabelGateway()
        {
            _logger = new Logger();
        }

        public Task<byte[]> ConvertFileFromat(byte[] content, string inputFormat, string outputFromat)
        {
            return Task.Run(() =>
            {
                var inputTempfileName = Path.GetTempFileName(); // file names are created to overcome utf-8 issues in file name.
                var outputTempfileName = Path.GetTempFileName();
                File.WriteAllBytes(inputTempfileName, content);
                var workingDirectory = ConfigurationManager.AppSettings[GPS_DIRECTORY_KEY].ToString();
                var arguments = "-i " + inputFormat + " -f \"" + inputTempfileName + "\" -o " + outputFromat + " -F \"" + outputTempfileName + "\"";
                _logger.Debug("Running: " + Path.Combine(workingDirectory, GPS_BABEL_EXE) + " " + arguments);
                var process = Process.Start(new ProcessStartInfo
                {
                    FileName = GPS_BABEL_EXE,
                    Arguments = arguments,
                    WorkingDirectory = workingDirectory,
                    WindowStyle = ProcessWindowStyle.Hidden,
                });
                process.WaitForExit(10000);
                File.Delete(inputTempfileName);
                var outputContent = File.ReadAllBytes(outputTempfileName);
                File.Delete(outputTempfileName);
                _logger.Debug("Finished converting data from: " + inputFormat + " to: " + outputFromat);
                return outputContent;
            });
        }
    }
}
