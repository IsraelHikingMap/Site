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
        public GpsBabelGateway()
        {

        }

        public string ConvertFileFromat(string filePath, string outputFromat)
        {
            var extension = Path.GetExtension(filePath);
            var outputFileName = Path.GetFileNameWithoutExtension(filePath) + "." + outputFromat;
            var workingDirectory = ConfigurationManager.AppSettings["serverRoot"].ToString() + ConfigurationManager.AppSettings["gpsbabel"].ToString();
            var process = Process.Start(new ProcessStartInfo
            {
                FileName = @"gpsbabel.exe",
                Arguments = "-i " + extension + " -f " + filePath + " -o " + outputFromat + " -F " + outputFileName,
                WorkingDirectory = workingDirectory,
            });
            process.WaitForExit(10000);
            return outputFileName;
        }
    }
}
