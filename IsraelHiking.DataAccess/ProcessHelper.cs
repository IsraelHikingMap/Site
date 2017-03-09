using System.Diagnostics;
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
            var processToRun = "cmd";
            var cmdArguments = arguments;
            if (fileName != "cmd")
            {
                cmdArguments = $"/c {fileName} {arguments}";
            }
            _logger.LogDebug($"Running: {processToRun} {cmdArguments}");
            using (var process = new Process())
            {
                process.StartInfo = new ProcessStartInfo
                {
                    FileName = processToRun,
                    Arguments = cmdArguments,
                    WorkingDirectory = workingDirectory,
                    WindowStyle = ProcessWindowStyle.Hidden,
                };
                process.Start();
                process.WaitForExit(timeOutInMilliseconds);
                if (process.ExitCode == 0)
                {
                    _logger.LogDebug($"Process {fileName} finished succesfully");
                }
                else
                {
                    _logger.LogError($"Process {fileName} did not finished succesfully");
                }
            }
        }
    }
}
