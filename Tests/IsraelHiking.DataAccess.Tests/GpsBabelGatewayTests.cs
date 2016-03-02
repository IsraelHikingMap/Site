using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.IO;
using System.Reflection;
using IsraelHiking.DataAccess.GPSBabel;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class GpsBabelGatewayTests
    {
        [TestMethod]
        public void ConvertFileFromat_FromGpxToKmlWithUTF8_ShouldSucceed()
        {
            var logger = new TraceLogger();
            var gateway = new GpsBabelGateway(logger, new ProcessHelper(logger));
            ConfigurationManager.AppSettings[ProcessHelper.BIN_FOLDER_KEY] = Path.GetDirectoryName(Assembly.GetAssembly(typeof(GpsBabelGatewayTests)).Location) ?? string.Empty;
            var content = File.ReadAllBytes(@"TestData\test.gpx");
            var outputContent = gateway.ConvertFileFromat(content, "gpx", "kml").Result;
            var kmlContent = File.ReadAllBytes(@"TestData\test.kml");
            for (var i = 0; i < 180; i++) // created at is different inside the files - first 180 should be the same...
            {
                Assert.AreEqual(kmlContent[i], outputContent[i], "difference in: " + i);
            }
        }
    }
}
