using System.IO;
using System.Linq;
using System.Reflection;
using System.Xml.Linq;
using IsraelHiking.DataAccess.GPSBabel;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests.GpsBabel
{
    [TestClass]
    public class GpsBabelGatewayTests
    {
        private IGpsBabelGateway _gpsBabelGateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var logger = new TraceLogger();
            var configurationProvider = Substitute.For<IConfigurationProvider>();
            configurationProvider.BinariesFolder.Returns(Path.GetDirectoryName(Assembly.GetAssembly(typeof(GpsBabelGatewayTests)).Location) ?? string.Empty);
            _gpsBabelGateway = new GpsBabelGateway(logger, new ProcessHelper(logger), configurationProvider);
        }

        [TestMethod]
        public void ConvertFileFromat_FromGpxToKmlWithUTF8_ShouldSucceed()
        {
            var content = File.ReadAllBytes(@"TestData\test.gpx");

            var outputContent = _gpsBabelGateway.ConvertFileFromat(content, "gpx", "kml").Result;

            var stream = new MemoryStream(outputContent);
            var actualKmlDoc = XDocument.Load(stream);
            var expectedKmlDoc = XDocument.Load(new FileStream(@"TestData\test.kml", FileMode.Open, FileAccess.Read));
            Assert.AreEqual(expectedKmlDoc.Descendants().Count(x => x.Name.LocalName == "LookAt"), actualKmlDoc.Descendants().Count(x => x.Name.LocalName == "LookAt"));
        }

        [TestMethod]
        public void ConvertFileFormat_SameInputOutput_ShouldReturnTheSameContent()
        {
            var content = new byte[] {1};
            var format = "gpx";

            var outputContent = _gpsBabelGateway.ConvertFileFromat(content, format, format).Result;

            CollectionAssert.AreEqual(content, outputContent);
        }
    }
}
