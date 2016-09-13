using System.Diagnostics;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess
{
    public class ProcessHelper : IProcessHelper
    {
        public const string BIN_FOLDER_KEY = "binFolder";

        private readonly ILogger _logger;

        public ProcessHelper(ILogger logger)
        {
            _logger = logger;
        }

        public void Start(string fileName, string arguments, string workingDirectory, int timeOutInMilliseconds)
        {
            var cmdArguments = "/c " + fileName + " " + arguments;
            _logger.Debug("Running: cmd " + arguments);
            using (var process = new Process())
            {
                process.StartInfo = new ProcessStartInfo
                {
                    FileName = "cmd",
                    Arguments = cmdArguments,
                    WorkingDirectory = workingDirectory,
                    WindowStyle = ProcessWindowStyle.Hidden,
                };
                process.Start();
                process.WaitForExit(timeOutInMilliseconds);
                if (process.ExitCode == 0)
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
