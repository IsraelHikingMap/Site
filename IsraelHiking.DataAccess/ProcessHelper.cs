using System.Diagnostics;
using System.IO;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public class ProcessHelper : IProcessHelper
    {
        private readonly ILogger _logger;

        public ProcessHelper(ILogger logger)
        {
            _logger = logger;
        }

        public void Start(string fileName, string arguments, string workingDirectory, int timeOutInMilliseconds)
        {
            _logger.Debug("Running: " + Path.Combine(workingDirectory, fileName) + " " + arguments);
            using (var process = Process.Start(new ProcessStartInfo
            {
                FileName = fileName,
                Arguments = arguments,
                WorkingDirectory = workingDirectory,
                WindowStyle = ProcessWindowStyle.Hidden,
            }))
            {
                process?.WaitForExit(timeOutInMilliseconds);
                if (process?.ExitCode == 0)
                {
                    _logger.Debug($"Process {fileName} finished succesfully");
                }
                else
                {
                    _logger.Error($"Process {fileName} did not finished succesfully");
                }
            }
        }
    }
}
