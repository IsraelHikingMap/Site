using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.IO;
using System.Text;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class CsvControllerTests
    {
        private CsvController _controller;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private IDataContainerConverterService _dataContainerConverterService;

        [TestInitialize]
        public void TestInitialize()
        {
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _controller = new CsvController(_dataContainerConverterService, _remoteFileFetcherGateway);
        }

        [TestMethod]
        public void UploadCsv_ShouldConvertItAndAddMissingFields()
        {
            IFormFile file = Substitute.For<IFormFile>();
            file.OpenReadStream()
                .Returns(new MemoryStream(Encoding.UTF8.GetBytes(
                    "Title,Description,Website,ImageUrl,FileUrl\r\ntitle,description,website?id=42,image,file")));
            _remoteFileFetcherGateway.GetFileContent("file").Returns(new RemoteFileFetcherGatewayResponse());
            var featureCollection = new FeatureCollection{ new Feature(new Point(new Coordinate(11, 12)), new AttributesTable()) };
            _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), FlowFormats.GEOJSON)
                .Returns(featureCollection.ToBytes());

            var results = _controller.UploadCsv(file, "\\?id=(.*)", "http://sourceImageUrl/1.png", "icon", "icon-color", Categories.ROUTE_HIKE).Result as FileStreamResult;

            Assert.IsNotNull(results);
            var memoryStream = new MemoryStream();
            results.FileStream.CopyTo(memoryStream);
            var resultsString = Encoding.UTF8.GetString(memoryStream.ToArray());
            Assert.IsTrue(resultsString.Contains("42"));
            Assert.IsTrue(resultsString.Contains("11"));
            Assert.IsTrue(resultsString.Contains("12"));
            Assert.IsTrue(resultsString.Contains("icon"));
            Assert.IsTrue(resultsString.Contains("icon-color"));
            Assert.IsTrue(resultsString.Contains("http://sourceImageUrl/1.png"));
            Assert.IsTrue(resultsString.Contains("Hiking"));
        }
    }
}
