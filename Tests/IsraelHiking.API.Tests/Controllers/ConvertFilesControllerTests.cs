using GeoJSON.Net.Geometry;
using IsraelHiking.API.Controllers;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using System.Web.Http.Results;

namespace IsraelHiking.API.Tests
{
    [TestClass]
    public class ConvertFilesControllerTests
    {
        private ConvertFilesController _controller;

        private IGpsBabelGateway _gpsBabelGateway;
        private IElevationDataStorage _elevationDataStorage;
        private IRemoveFileFetcherGateway _removeFileFetcherGateway;

        private const string KML_DATA = @"<?xml version=""1.0"" encoding=""UTF-8""?>
                                        <kml xmlns=""http://www.opengis.net/kml/2.2"">
                                        <Document>
                                        <Placemark>
                                        <name>Route 1</name>
                                        <ExtendedData>
                                        <Data name=""name"">
                                        <value>Route 1</value>
                                        </Data>
                                        </ExtendedData>
                                        <LineString>
                                        <coordinates>
                                        34.96160311720012,31.995949048868365,104 
                                        34.961603,31.99595,104 
                                        34.961874,31.99596,105 
                                        34.962098,31.995856,107 
                                        34.962692,31.9955,102 
                                        34.962896,31.995329,99.5
                                        </coordinates></LineString>
                                        </Placemark>
                                        </Document>
                                        </kml>";

        [TestInitialize]
        public void TestInitialize()
        {
            ILogger logger = Substitute.For<ILogger>();
            _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _removeFileFetcherGateway = Substitute.For<IRemoveFileFetcherGateway>();
            _controller = new ConvertFilesController(logger, _gpsBabelGateway, _elevationDataStorage, _removeFileFetcherGateway);
        }

        [TestMethod]
        public void GetRemoteFile_ConvertKmlToGeoJson_ShouldReturnOneLineString()
        {
            byte[] bytes = Encoding.ASCII.GetBytes(KML_DATA);
            _removeFileFetcherGateway.GetFileContent("someurl.kml").Returns(Task.FromResult(bytes));
            _gpsBabelGateway.ConvertFileFromat(bytes, "kml", "kml").Returns(Task.FromResult(bytes));
            var featureCollection = _controller.GetRemoteFile("someurl.kml").Result;

            Assert.AreEqual(1, featureCollection.Features.Count);
            Assert.IsTrue(featureCollection.Features[0].Geometry is LineString);
        }

        [TestMethod]
        public void PostConvertFile_ConvertToKml_ShouldReturnByteArray()
        {
            var multipartContent = new MultipartContent();
            var streamContent = new StreamContent(new MemoryStream(new byte[1] { 1 }));
            streamContent.Headers.ContentDisposition = new ContentDispositionHeaderValue("form-data")
            {
                Name = "\"files\"",
                FileName = "\"SomeFile.twl\""
            };
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("application/kml");
            multipartContent.Add(streamContent);
            _controller.Request = new HttpRequestMessage();
            _controller.Request.Content = multipartContent;
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), "naviguide", "kml").Returns(Task.FromResult(new byte[2] { 1, 1 }));

            var response = _controller.PostConvertFile("kml").Result as OkNegotiatedContentResult<byte[]>;

            Assert.AreEqual(2, response.Content.Length);
        }

        [TestMethod]
        public void PostConvertFile_NoFiles_ShouldReturnBadRequest()
        {
            var multipartContent = new MultipartContent();
            _controller.Request = new HttpRequestMessage();
            _controller.Request.Content = multipartContent;
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), "naviguide", "kml").Returns(Task.FromResult(new byte[2] { 1, 1 }));

            var response = _controller.PostConvertFile("kml").Result as BadRequestResult;

            Assert.IsNotNull(response);
        }
    }
}
