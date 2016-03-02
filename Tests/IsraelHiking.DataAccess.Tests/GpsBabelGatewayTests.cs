using System;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.Configuration;
using System.IO;
using System.Reflection;
using System.Text;
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
            var actualKml = Encoding.UTF8.GetString(outputContent);
            var expectedKml = File.ReadAllText(@"TestData\test.kml");

            var startIndex = actualKml.IndexOf("\r\n    <snippet>");
            var endIndex = actualKml.IndexOf("</snippet>");
            actualKml = actualKml.Remove(startIndex, endIndex - startIndex + "</snippet>".Length).Substring(0, 500);
            Assert.AreEqual(expectedKml.Substring(0, 500), actualKml);
        }
    }
}
