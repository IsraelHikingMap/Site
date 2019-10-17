using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace IsraelHiking.API.Tests.Controllers
{
    [TestClass]
    public class FilesControllerTests
    {
        private FilesController _controller;

        private IGpsBabelGateway _gpsBabelGateway;
        private IElevationDataStorage _elevationDataStorage;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
        private IDataContainerConverterService _dataContainerConverterService;
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
                    <trkpt lat='31.842176' lon='34.965708'></trkpt>
                </trkseg>
            </trk>
            </gpx>";

        [TestInitialize]
        public void TestInitialize()
        {
            _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            var factory = Substitute.For<IHttpGatewayFactory>();
            factory.CreateRemoteFileFetcherGateway(Arg.Any<TokenAndSecret>()).Returns(_remoteFileFetcherGateway);
            _gpxDataContainerConverter = new GpxDataContainerConverter();
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(new ConfigurationData());
            _dataContainerConverterService = new DataContainerConverterService(_gpsBabelGateway, _gpxDataContainerConverter, new RouteDataSplitterService(new ItmWgs84MathTransfromFactory(), optionsProvider), new IConverterFlowItem[0]);
            _controller = new FilesController(_elevationDataStorage, factory, _dataContainerConverterService, new LruCache<string, TokenAndSecret>(optionsProvider, Substitute.For<ILogger>()));
        }

        [TestMethod]
        public void GetSupportedFileTypes_ShouldGetThem()
        {
            var results = _controller.GetSupportedFileTypes();

            Assert.IsTrue(results.Count > 0);
        }

        [TestMethod]
        public void GetRemoteFile_ConvertKmlToGeoJson_ShouldReturnOnePointAndOneLineString()
        {
            var url = "someurl";
            byte[] bytes = Encoding.ASCII.GetBytes(GPX_DATA);
            _remoteFileFetcherGateway.GetFileContent(url).Returns(new RemoteFileFetcherGatewayResponse { Content = bytes, FileName = "file.KML" });
            _gpsBabelGateway.ConvertFileFromat(bytes, Arg.Is<string>(x => x.Contains("kml")), Arg.Is<string>(x => x.Contains("gpx"))).Returns(bytes);
            _controller.SetupIdentity();

            var dataContainer = _controller.GetRemoteFile(url).Result;

            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
        }

        [TestMethod]
        public void PostSaveFile_ConvertToGpx_ShouldReturnByteArray()
        {
            var dataContainer = new DataContainer
            {
                Routes = new List<RouteData>
                {
                    new RouteData
                    {
                        Markers = new List<MarkerData>
                        {
                            new MarkerData
                            {
                                Latlng = new LatLng {Lat = 10, Lng = 10},
                                Title = "title"
                            }
                        },
                        Segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {Latlngs = new List<LatLngTime> {new LatLngTime()}}
                        }
                    }
                }
            };
            var expectedGpx = _gpxDataContainerConverter.ToGpx(dataContainer);

            var bytes = _controller.PostSaveFile("gpx", dataContainer).Result;

            
            CollectionAssert.AreEqual(expectedGpx.ToBytes(), bytes);
        }

        [TestMethod]
        public void PostOpenFile_NoFile_ShouldReturnBadRequest()
        {
            var results = _controller.PostOpenFile(null).Result as BadRequestResult;

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void PostOpenFile_GpxFile_ShouldReturnDataContainerAndUpdateElevation()
        {
            var file = Substitute.For<IFormFile>();
            file.FileName.Returns("somefile.gpx");
            file.When(f => f.CopyToAsync(Arg.Any<MemoryStream>())).Do(x => (x[0] as MemoryStream).Write(Encoding.ASCII.GetBytes(GPX_DATA), 0, Encoding.ASCII.GetBytes(GPX_DATA).Length));
            _elevationDataStorage.GetElevation(Arg.Any<Coordinate>()).Returns(1);

            var results = _controller.PostOpenFile(file).Result as OkObjectResult;
            Assert.IsNotNull(results);
            var dataContainer = results.Value as DataContainer;

            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Segments.Count);
            Assert.AreEqual(6, dataContainer.Routes.First().Segments.First().Latlngs.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
            Assert.IsTrue(dataContainer.Routes.SelectMany(r => r.Segments.SelectMany(s => s.Latlngs)).All(l => l.Alt != 0));
        }
    }
}
