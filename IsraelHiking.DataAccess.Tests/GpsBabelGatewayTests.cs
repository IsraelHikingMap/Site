using System;
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
        [Ignore] // requires actual file and GPSBabel installed...
        public void ConvertFileFromat_FromGpxToKmlWithUTF8_ShouldSucceed()
        {
            var file = _gateway.ConvertFileFromat(@"C:\Users\Harel\AppData\Local\Temp\IsraelHiking_2015-10-17_15-18-30_362\2015-09-24 יקנעם מושבה__20150924_1003.gpx", "KML");
            Assert.IsTrue(File.Exists(file));
        }
    }
}
