using System.Diagnostics;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.DataAccess
{
    public class ProcessHelper : IProcessHelper
    {
        private readonly ILogger _logger;
        public string StandardOutput { get; private set; }

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
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    RedirectStandardOutput = true,
                };
                StandardOutput = string.Empty;
                process.Start();
                StandardOutput = process.StandardOutput.ReadToEnd();

                process.WaitForExit(timeOutInMilliseconds);

                while (!process.StandardOutput.EndOfStream)
                {
                    StandardOutput += process.StandardOutput.ReadLine();
                }
                StandardOutput = StandardOutput.Replace("\0", string.Empty).Trim();
                if (process.ExitCode == 0)
                {
                    _logger.LogDebug($"Process {fileName} finished successfully");
                }
                else
                {
                    _logger.LogError($"Process {processToRun} {cmdArguments} did not finished successfully");
                }
            }
        }
    }
}
