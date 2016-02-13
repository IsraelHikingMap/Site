using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.IO;
using IsraelHiking.DataAccessInterfaces;
using NSubstitute;

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
            ConfigurationManager.AppSettings["gpsbabel"] = @"C:\Program Files(x86)\GpsBabel\";
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
