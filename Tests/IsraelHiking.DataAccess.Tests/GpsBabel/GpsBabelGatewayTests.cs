using System.IO;
using System.Linq;
using System.Xml.Linq;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;

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
            _gpsBabelGateway = new GpsBabelGateway(logger);
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
        public void ConvertFileFromat_FromGpxTWLAndBack_ShouldSucceed()
        {
            var content = File.ReadAllBytes(@"TestData\test.gpx");
            var referenceGpx = content.ToGpx();
            var outputContent = _gpsBabelGateway.ConvertFileFromat(content, "gpx", FlowFormats.TWL_BABEL_FORMAT).Result;
            outputContent = _gpsBabelGateway.ConvertFileFromat(outputContent, FlowFormats.TWL_BABEL_FORMAT, FlowFormats.GPX_BABEL_FORMAT).Result;
            var gpx = outputContent.ToGpx();
            Assert.AreEqual(1, gpx.rte.Length);
            Assert.AreEqual(referenceGpx.trk.First().trkseg.First().trkpt.Length, gpx.rte.First().rtept.Length);
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
