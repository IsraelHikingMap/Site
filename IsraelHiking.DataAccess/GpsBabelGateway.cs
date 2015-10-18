using System;
using System.Collections.Generic;
using System.Configuration;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class GpsBabelGateway
    {
        private readonly Logger _logger;

        public GpsBabelGateway()
        {
            _logger = new Logger();
        }

        public string ConvertFileFromat(string filePath, string outputFromat)
        {
            var extension = Path.GetExtension(filePath);
            var inputTempfileName = Path.GetTempFileName(); // file names are created to overcome utf-8 issues in file name.
            var outputTempfileName = Path.GetTempFileName();
            File.Copy(filePath, inputTempfileName, true);
            var workingDirectory = ConfigurationManager.AppSettings["gpsbabel"].ToString();
            var executable = "gpsbabel.exe";
            var agruments = "-i " + ConvertExtenstionToFormat(extension) + " -f \"" + inputTempfileName + "\" -o " + ConvertExtenstionToFormat(outputFromat) + " -F \"" + outputTempfileName + "\"";
            _logger.Debug("Running: " + Path.Combine(workingDirectory, executable) + " " + agruments);
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = executable,
                Arguments = agruments,
                WorkingDirectory = workingDirectory,
                WindowStyle = ProcessWindowStyle.Hidden,
            });
            process.WaitForExit(10000);
            File.Delete(inputTempfileName);
            var outputFileName = Path.Combine(Path.GetDirectoryName(filePath), Path.GetFileNameWithoutExtension(filePath) + "." + outputFromat);
            File.Move(outputTempfileName, outputFileName);
            return outputFileName;
        }

        private string ConvertExtenstionToFormat(string extension)
        {
            extension = extension.Replace(".", "");
            if (extension == "twl")
            {
                return "naviguide";
            }
            return extension.ToLower();
        }
    }
}
