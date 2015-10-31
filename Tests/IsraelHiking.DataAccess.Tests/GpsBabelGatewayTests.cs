using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.IO;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class GpsBabelGatewayTests
    {
        private GpsBabelGateway _gateway = new GpsBabelGateway();

        [TestInitialize]
        public void TestInialize()
        {
            ConfigurationManager.AppSettings["gpsbabel"] = @"C:\GpsBabel\";
        }

        [TestMethod]
        public void ConvertFileFromat_FromGpxToKmlWithUTF8_ShouldSucceed()
        {
            var content = File.ReadAllBytes(@"TestData\test.gpx");
            var outputContent = _gateway.ConvertFileFromat(content, "gpx", "kml").Result;
            var kmlContent = File.ReadAllBytes(@"TestData\test.kml");
            for (int i = 0; i < 180; i++) // created at is different inside the files - first 180 should be the same...
            {
                Assert.AreEqual(kmlContent[i], outputContent[i], "difference in: " + i);
            }            
        }
    }
}
