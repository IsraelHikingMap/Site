using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;
using System.Web.Http.Results;
using GeoJSON.Net.Geometry;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class ConvertFilesControllerTests
    {
        private ConvertFilesController _controller;

        private IGpsBabelGateway _gpsBabelGateway;
        private IElevationDataStorage _elevationDataStorage;
        private IRemoteFileFetcherGateway _removeFileFetcherGateway;
        private IFileConversionService _fileConversionService;
        private IGpxDataContainerConverter _gpxDataContainerConverter;

        private const string GPX_DATA = @"<?xml version='1.0' encoding='UTF-8' standalone='no' ?>
            <gpx xmlns='http://www.topografix.com/GPX/1/1' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xsi:schemaLocation='http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd' version='1.1' creator='IsraelHikingMap'>
            <wpt lat='31.85073184447357' lon='34.964332580566406'>
                <name>title</name>
            </wpt>
            <trk>
                <name>Route 1</name>
                <trkseg>
                    <trkpt lat='31.841402444946397' lon='34.96433406040586'><ele>167</ele></trkpt>
                    <trkpt lat='31.8414' lon='34.964336'><ele>167.5</ele></trkpt>
                    <trkpt lat='31.84205' lon='34.965344'><ele>161</ele></trkpt>
                    <trkpt lat='31.842161' lon='34.965611'><ele>161</ele></trkpt>
                    <trkpt lat='31.842175' lon='34.965707'><ele>161</ele></trkpt>
                </trkseg>
            </trk>
            </gpx>";


        [TestInitialize]
        public void TestInitialize()
        {
            ILogger logger = Substitute.For<ILogger>();
            _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _removeFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            _gpxDataContainerConverter = new GpxDataContainerConverter();
            _fileConversionService = new FileConversionService(_gpsBabelGateway, new GpxGeoJsonConverter(), _gpxDataContainerConverter, new CoordinatesConverter());
            _controller = new ConvertFilesController(logger, _elevationDataStorage, _removeFileFetcherGateway, _fileConversionService, _gpxDataContainerConverter);
        }

        [TestMethod]
        public void GetRemoteFile_ConvertKmlToGeoJson_ShouldReturnOnePointAndOneLineString()
        {
            var url = "someurl";
            byte[] bytes = Encoding.ASCII.GetBytes(GPX_DATA);
            _removeFileFetcherGateway.GetFileContent(url).Returns(Task.FromResult(new RemoteFileFetcherGatewayResponse { Content = bytes, FileName = "file.KML" }));
            _gpsBabelGateway.ConvertFileFromat(bytes, "kml", "gpx,gpxver=1.1").Returns(Task.FromResult(bytes));

            var dataContainer = _controller.GetRemoteFile(url).Result;

            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.markers.Count);
        }

        [TestMethod]
        public void PostSaveFile_ConvertToGpx_ShouldReturnByteArray()
        {
            var dataContainer = new DataContainer
            {
                markers = new List<MarkerData> {new MarkerData
                {
                    latlng = new LatLng {lat = 10, lng = 10}, title = "title"
                }},
                routes = new List<RouteData>
                {
                    new RouteData
                    {
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData { latlngzs =  new List<LatLngZ> {  new LatLngZ()} }
                        }
                    }
                }
            };

            var bytes = _controller.PostSaveFile(dataContainer);

            CollectionAssert.AreEqual(_gpxDataContainerConverter.ToGpx(dataContainer).ToBytes(), bytes);
        }

        [TestMethod]
        public void PostOpenFile_NoFile_ShouldReturnBadRequest()
        {
            var multipartContent = new MultipartContent();
            _controller.Request = new HttpRequestMessage { Content = multipartContent };

            var results = _controller.PostOpenFile().Result as BadRequestResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostOpenFile_GpxFile_ShouldReturnDataContainer()
        {
            var multipartContent = new MultipartContent();
            var streamContent = new StreamContent(new MemoryStream(Encoding.ASCII.GetBytes(GPX_DATA)));
            streamContent.Headers.ContentDisposition = new ContentDispositionHeaderValue("form-data")
            {
                Name = "\"files\"",
                FileName = "\"SomeFile.gpx\""
            };
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("application/gpx");
            multipartContent.Add(streamContent);
            _controller.Request = new HttpRequestMessage { Content = multipartContent };

            var results = _controller.PostOpenFile().Result as OkNegotiatedContentResult<DataContainer>;
            var dataContainer = results.Content;

            Assert.AreEqual(1, dataContainer.markers.Count);
            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.routes.First().segments.Count);
            Assert.AreEqual(5, dataContainer.routes.First().segments.First().latlngzs.Count);
        }


        [TestMethod]
        public void PostConvertFile_ConvertToKml_ShouldReturnByteArray()
        {
            var multipartContent = new MultipartContent();
            var streamContent = new StreamContent(new MemoryStream(new byte[] { 1 }));
            streamContent.Headers.ContentDisposition = new ContentDispositionHeaderValue("form-data")
            {
                Name = "\"files\"",
                FileName = "\"SomeFile.twl\""
            };
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("application/kml");
            multipartContent.Add(streamContent);
            _controller.Request = new HttpRequestMessage {Content = multipartContent};
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), "naviguide", "kml").Returns(Task.FromResult(new byte[] { 1, 1 }));

            var response = _controller.PostConvertFile("kml").Result as OkNegotiatedContentResult<byte[]>;

            Assert.IsNotNull(response);
            Assert.AreEqual(2, response.Content.Length);
        }

        [TestMethod]
        public void PostConvertFile_NoFiles_ShouldReturnBadRequest()
        {
            var multipartContent = new MultipartContent();
            _controller.Request = new HttpRequestMessage {Content = multipartContent};
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), "naviguide", "kml").Returns(Task.FromResult(new byte[] { 1, 1 }));

            var response = _controller.PostConvertFile("kml").Result as BadRequestResult;

            Assert.IsNotNull(response);
        }

        [TestMethod]
        public void PostConvertFile_FromGpxToGeoJson_ShouldReturnGeoJson()
        {
            var bytes = Encoding.ASCII.GetBytes(GPX_DATA);
            var multipartContent = new MultipartContent();
            var streamContent = new StreamContent(new MemoryStream(bytes));
            streamContent.Headers.ContentDisposition = new ContentDispositionHeaderValue("form-data")
            {
                Name = "\"files\"",
                FileName = "\"SomeFile.gpx\""
            };
            streamContent.Headers.ContentType = new MediaTypeHeaderValue("application/gpx");
            multipartContent.Add(streamContent);
            _controller.Request = new HttpRequestMessage { Content = multipartContent };
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(bytes));

            var response = _controller.PostConvertFile("geojson").Result as OkNegotiatedContentResult<byte[]>;

            Assert.IsNotNull(response);
        }
    }
}
