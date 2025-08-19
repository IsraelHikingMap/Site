using System;
using IsraelHiking.API.Controllers;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Microsoft.Extensions.Logging;
using NSubstitute.ExceptionExtensions;

namespace IsraelHiking.API.Tests.Controllers;

[TestClass]
public class FilesControllerTests
{
    private FilesController _controller;

    private IGpsBabelGateway _gpsBabelGateway;
    private IElevationGateway _elevationGateway;
    private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
    private IDataContainerConverterService _dataContainerConverterService;
    private IGpxDataContainerConverter _gpxDataContainerConverter;
    private IOfflineFilesService _offlineFilesService;
    private IReceiptValidationGateway _receiptValidationGateway;

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
        _elevationGateway = Substitute.For<IElevationGateway>();
        _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(info => Enumerable.Repeat(1.0, info.Arg<Coordinate[]>().Length).ToArray());
        _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
        _gpxDataContainerConverter = new GpxDataContainerConverter();
        var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
        optionsProvider.Value.Returns(new ConfigurationData());
        _dataContainerConverterService = new DataContainerConverterService(_gpsBabelGateway, _gpxDataContainerConverter, new RouteDataSplitterService(new ItmWgs84MathTransformFactory(), optionsProvider), Array.Empty<IConverterFlowItem>());
        _offlineFilesService = Substitute.For<IOfflineFilesService>();
        _receiptValidationGateway = Substitute.For<IReceiptValidationGateway>();
        _controller = new FilesController(_elevationGateway, _remoteFileFetcherGateway, _dataContainerConverterService, _offlineFilesService, _receiptValidationGateway, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetRemoteFile_ConvertKmlToGeoJson_ShouldReturnOnePointAndOneLineString()
    {
        var url = "someUrl";
        byte[] bytes = Encoding.ASCII.GetBytes(GPX_DATA);
        _remoteFileFetcherGateway.GetFileContent(url).Returns(new RemoteFileFetcherGatewayResponse { Content = bytes, FileName = "file.KML" });
        _gpsBabelGateway.ConvertFileFromat(bytes, Arg.Is<string>(x => x.Contains("kml")), Arg.Is<string>(x => x.Contains("gpx"))).Returns(bytes);
        _controller.SetupIdentity();

        var dataContainer = _controller.GetRemoteFile(url).Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
        Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
    }

    [TestMethod]
    public void PostConvertFile_InvalidFileFormat_ShouldReturnBadRequest()
    {
        var result = _controller.PostConvertFile("42", new DataContainerPoco()).Result as BadRequestObjectResult;

        Assert.IsNotNull(result);
    }

    [TestMethod]
    public void PostConvertFile_ConvertToGpx_ShouldReturnByteArray()
    {
        var dataContainer = new DataContainerPoco
        {
            Routes =
            [
                new RouteData
                {
                    Markers =
                    [
                        new MarkerData
                        {
                            Latlng = new LatLng { Lat = 10, Lng = 10 },
                            Title = "title"
                        }
                    ],
                    Segments = [new RouteSegmentData { Latlngs = [new LatLngTime()] }]
                }
            ]
        };
        var expectedGpx = _gpxDataContainerConverter.ToGpx(dataContainer);

        var result = _controller.PostConvertFile("gpx", dataContainer).Result as OkObjectResult;

        Assert.IsNotNull(result);
        CollectionAssert.AreEqual(expectedGpx.ToBytes(), result.Value as byte[]);
    }

    [TestMethod]
    public void PostOpenFile_NoFile_ShouldReturnBadRequest()
    {
        var results = _controller.PostOpenFile(null).Result as BadRequestResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void PostOpenFile_FileWithBadExtension_ShouldReturnBadRequest()
    {
        var file = Substitute.For<IFormFile>();
        file.FileName.Returns("someFile.nope!");

        var results = _controller.PostOpenFile(file).Result as BadRequestResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void PostOpenFile_GpxFile_ShouldReturnDataContainerAndUpdateElevation()
    {
        var file = Substitute.For<IFormFile>();
        file.FileName.Returns("someFile.gpx");
        file.When(f => f.CopyToAsync(Arg.Any<MemoryStream>())).Do(x => (x[0] as MemoryStream)?.Write(Encoding.ASCII.GetBytes(GPX_DATA), 0, Encoding.ASCII.GetBytes(GPX_DATA).Length));

        var results = _controller.PostOpenFile(file).Result as OkObjectResult;
        Assert.IsNotNull(results);
        var dataContainer = results.Value as DataContainerPoco;

        Assert.IsNotNull(dataContainer);
        Assert.AreEqual(1, dataContainer.Routes.Count);
        Assert.AreEqual(1, dataContainer.Routes.First().Segments.Count);
        Assert.AreEqual(6, dataContainer.Routes.First().Segments.First().Latlngs.Count);
        Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
        Assert.IsTrue(dataContainer.Routes.SelectMany(r => r.Segments.SelectMany(s => s.Latlngs)).All(l => l.Alt != 0));
        Assert.AreEqual(1, dataContainer.Routes.SelectMany(r => r.Segments.SelectMany(s => s.Latlngs)).Count(l => l.Alt == 1));
    }

    [TestMethod]
    public void GetOfflineFiles_NotEntitled_ShouldGetForbid()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(false);

        var results = _controller.GetOfflineFiles(DateTime.Now).Result as ForbidResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetOfflineFiles_CommunicationIssue_ShouldGetServerError()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Throws(new Exception("some text"));

        Assert.ThrowsException<AggregateException>(() => _controller.GetOfflineFiles(DateTime.Now).Result);
    }

    [TestMethod]
    public void GetOfflineFiles_ShouldGetTheList()
    {
        _controller.SetupIdentity();
        var dict = new Dictionary<string, DateTime>();
        _offlineFilesService.GetUpdatedFilesList(Arg.Any<DateTime>())
            .Returns(dict);
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);

        var results = _controller.GetOfflineFiles(DateTime.Now).Result as OkObjectResult;

        Assert.IsNotNull(results);
        var resultDict = results.Value as Dictionary<string, DateTime>;
        Assert.IsNotNull(resultDict);
        Assert.AreEqual(dict.Count, resultDict.Count);
    }

    [TestMethod]
    public void GetOfflineFile_NotEntitled_ShouldNotGetIt()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(false);

        var results = _controller.GetOfflineFile("file").Result as ForbidResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void GetOfflineFile_ShouldGetIt()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);
        _offlineFilesService.GetFileContent("file").Returns(new MemoryStream());

        var results = _controller.GetOfflineFile("file").Result as FileResult;

        Assert.IsNotNull(results);
    }

    [TestMethod]
    public void IsSubscribed_ShouldGetIt()
    {
        _controller.SetupIdentity();
        _receiptValidationGateway.IsEntitled(Arg.Any<string>()).Returns(true);

        var results = _controller.IsSubscribed().Result;

        Assert.IsTrue(results);
    }
}