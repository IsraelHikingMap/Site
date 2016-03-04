using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Xml.Linq;
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
            MemoryStream stream = new MemoryStream(outputContent);
            var actualKmlDoc = XDocument.Load(stream);

            var expectedKmlDoc = XDocument.Load(new FileStream(@"TestData\test.kml", FileMode.Open, FileAccess.Read));
            Assert.AreEqual(expectedKmlDoc.Descendants().Count(x => x.Name.LocalName == "LookAt"), actualKmlDoc.Descendants().Count(x => x.Name.LocalName == "LookAt"));
        }
    }
}
