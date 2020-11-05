using System.IO;
using System.Linq;
using System.Net.Http;
using System.Xml.Linq;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
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
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _gpsBabelGateway = new GpsBabelGateway(logger, factory, options);
        }

        [TestMethod]
        [Ignore]
        public void ConvertFileFromat_FromGpxToKmlWithUTF8_ShouldSucceed()
        {
            var content = File.ReadAllBytes(Path.Combine("TestData","test.gpx"));

            var outputContent = _gpsBabelGateway.ConvertFileFromat(content, "gpx", "kml").Result;

            var stream = new MemoryStream(outputContent);
            var actualKmlDoc = XDocument.Load(stream);
            var expectedKmlDoc = XDocument.Load(new FileStream(Path.Combine("TestData","test.kml"), FileMode.Open, FileAccess.Read));
            Assert.AreEqual(expectedKmlDoc.Descendants().Count(x => x.Name.LocalName == "LookAt"), actualKmlDoc.Descendants().Count(x => x.Name.LocalName == "LookAt"));
        }

        [TestMethod]
        [Ignore]
        public void ConvertFileFromat_FromGpxTWLAndBack_ShouldSucceed()
        {
            var content = File.ReadAllBytes(Path.Combine("TestData","test.gpx"));
            var referenceGpx = content.ToGpx();
            var outputContent = _gpsBabelGateway.ConvertFileFromat(content, "gpx", FlowFormats.TWL_BABEL_FORMAT).Result;
            outputContent = _gpsBabelGateway.ConvertFileFromat(outputContent, FlowFormats.TWL_BABEL_FORMAT, FlowFormats.GPX_BABEL_FORMAT).Result;
            var gpx = outputContent.ToGpx();
            Assert.AreEqual(1, gpx.Routes.Count);
            Assert.AreEqual(referenceGpx.Tracks.First().Segments.First().Waypoints.Count, gpx.Routes.First().Waypoints.Count);
        }

        [TestMethod]
        [Ignore]
        public void ConvertFileFormat_SameInputOutput_ShouldReturnTheSameContent()
        {
            var content = new byte[] {1};
            var format = "gpx";

            var outputContent = _gpsBabelGateway.ConvertFileFromat(content, format, format).Result;

            CollectionAssert.AreEqual(content, outputContent);
        }
    }
}
