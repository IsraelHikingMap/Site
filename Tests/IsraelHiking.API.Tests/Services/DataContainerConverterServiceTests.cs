using ICSharpCode.SharpZipLib.BZip2;
using ICSharpCode.SharpZipLib.GZip;
using ICSharpCode.SharpZipLib.Zip;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class DataContainerConverterServiceTests
{
    private IDataContainerConverterService _converterService;
    private IRouteDataSplitterService _routeDataSplitterService;
    private IGpsBabelGateway _gpsBabelGateway;
    private byte[] _randomBytes;
    private GpxFile _simpleGpx;

    [TestInitialize]
    public void TestInitialize()
    {
        _randomBytes = [0, 1, 1, 0];
        _simpleGpx = new GpxFile();
        _simpleGpx.Waypoints.Add(new GpxWaypoint(new GpxLongitude(0), new GpxLatitude(0), null));
        _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
        _routeDataSplitterService = Substitute.For<IRouteDataSplitterService>();
        var gpxGeoJsonConverter = new GpxGeoJsonConverter(new GeometryFactory());
        var converterFlowItems = new List<IConverterFlowItem>
        {
            new GeoJsonGpxConverterFlow(gpxGeoJsonConverter),
            new GpxGeoJsonConverterFlow(gpxGeoJsonConverter),
            new GpxToSingleTrackGpxConverterFlow(),
            new GpxToRouteGpxConverterFlow(),
            new KmzToKmlConverterFlow(),
            new GpxGzToGpxConverterFlow(),
            new GpxVersion1ToGpxVersion11ConverterFlow(_gpsBabelGateway),
            new GpxBz2ToGpxConverterFlow()
        };
        _converterService = new DataContainerConverterService(_gpsBabelGateway, new GpxDataContainerConverter(), _routeDataSplitterService, converterFlowItems);
    }

    [TestMethod]
    public void ConvertDataContainerToGpx_ShouldConvertToGpx()
    {
        var dataContainer = new DataContainerPoco();

        var results = _converterService.ToAnyFormat(dataContainer, FlowFormats.GPX).Result.ToGpx();

        Assert.IsFalse(results.Waypoints.Any());
        Assert.IsFalse(results.Routes.Any());
        Assert.IsFalse(results.Tracks.Any());
    }

    [TestMethod]
    public void ConvertDataContainerToGeoJson_ShouldConvertToGeoJson()
    {
        var dataContainer = new DataContainerPoco
        {
            Routes =
            [
                new RouteData
                {
                    Markers = [new MarkerData { Latlng = new LatLng(0, 0) }],
                    Segments =
                    [
                        new RouteSegmentData
                        {
                            Latlngs = [new LatLngTime(0, 0), new LatLngTime(0, 0)]
                        },

                        new RouteSegmentData
                        {
                            Latlngs = [new LatLngTime(0, 0), new LatLngTime(1, 1)]
                        }
                    ]
                }
            ]
        };
        var results = _converterService.ToAnyFormat(dataContainer, FlowFormats.GEOJSON).Result.ToFeatureCollection();

        Assert.AreEqual(2, results.Count);
        Assert.AreEqual(2, results.Last().Geometry.Coordinates.Length);
    }

    [TestMethod]
    public void ConvertDataContainerToGeoJson_WithNonMatchingSegments_ShouldConvertToGeoJson()
    {
        var dataContainer = new DataContainerPoco
        {
            Routes =
            [
                new RouteData
                {
                    Segments =
                    [
                        new RouteSegmentData
                        {
                            Latlngs = [new LatLngTime(0, 0), new LatLngTime(0, 0)]
                        },

                        new RouteSegmentData
                        {
                            Latlngs = [new LatLngTime(0.1, 0.1), new LatLngTime(1, 1)]
                        }
                    ]
                }
            ]
        };
        var results = _converterService.ToAnyFormat(dataContainer, FlowFormats.GEOJSON).Result.ToFeatureCollection();

        Assert.AreEqual(1, results.Count);
        Assert.AreEqual(2, results.First().Geometry.Coordinates.Length);
    }

    [TestMethod]
    public void ConvertDataContainerToKml_ShouldConvertToKmlUsingGpsBabel()
    {
        var dataContainer = new DataContainerPoco();
        _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(_randomBytes);

        var results = _converterService.ToAnyFormat(dataContainer, FlowFormats.KML).Result;

        CollectionAssert.AreEqual(_randomBytes, results);
    }

    [TestMethod]
    public void ConvertDataContainerToGpxSingleTrack_ShouldConvertToGpxUsingGpsBabelAndThenToGpxSingleTrack()
    {
        var dataContainer = new DataContainerPoco
        {
            Routes =
            [
                new RouteData
                {
                    Segments =
                    [
                        new RouteSegmentData
                        {
                            Latlngs =
                            [
                                new LatLngTime { Lat = 1, Lng = 2 },
                                new LatLngTime { Lat = 3, Lng = 4 }
                            ]
                        },

                        new RouteSegmentData
                        {
                            Latlngs =
                            [
                                new LatLngTime { Lat = 5, Lng = 6 },
                                new LatLngTime { Lat = 7, Lng = 8 }
                            ]
                        }
                    ]
                }
            ]
        };

        var results = _converterService.ToAnyFormat(dataContainer, FlowFormats.GPX_SINGLE_TRACK).Result;
        var gpx = results.ToGpx();

        Assert.AreEqual(1, gpx.Tracks.Count);
        Assert.AreEqual(1, gpx.Tracks.First().Segments.Length);
        Assert.AreEqual(1.0, gpx.Tracks.First().Segments.First().Waypoints.First().Latitude);
        Assert.AreEqual(8.0, gpx.Tracks.First().Segments.First().Waypoints.Last().Longitude);
    }

    [TestMethod]
    public void ConvertDataContainerToGpxRoute_ShouldConvertToGpxUsingGpsBabelAndThenToGpxRoute()
    {
        var dataContainer = new DataContainerPoco
        {
            Routes =
            [
                new RouteData
                {
                    Segments =
                    [
                        new RouteSegmentData
                        {
                            Latlngs =
                            [
                                new LatLngTime { Lat = 1, Lng = 2 },
                                new LatLngTime { Lat = 3, Lng = 4 }
                            ]
                        },

                        new RouteSegmentData
                        {
                            Latlngs =
                            [
                                new LatLngTime { Lat = 5, Lng = 6 },
                                new LatLngTime { Lat = 7, Lng = 8 }
                            ]
                        }
                    ]
                }
            ]
        };

        var results = _converterService.ToAnyFormat(dataContainer, FlowFormats.GPX_ROUTE).Result;
        var gpx = results.ToGpx();

        Assert.AreEqual(1, gpx.Routes.Count);
        Assert.AreEqual(1, gpx.Routes.First().Waypoints.First().Latitude.Value);
        Assert.AreEqual(8, gpx.Routes.First().Waypoints.Last().Longitude.Value);
    }

    [TestMethod]
    public void ConvertGpxToDataContainer_ShouldConvertToDataContainer()
    {
        var results = _converterService.ToDataContainer(_simpleGpx.ToBytes(), FlowFormats.GPX).Result;

        Assert.AreEqual(1, results.Routes.Count);
    }

    [TestMethod]
    public void ConvertGpxToDataContainer_NonSiteFileWithTwoSegmenetsNoName_ShouldManipulateRouteData()
    {
        var gpx = new GpxFile();
        gpx.Tracks.Add(new GpxTrack().WithSegments(
            [
                ..new[]
                {
                    new GpxTrackSegment(new ImmutableGpxWaypointTable([
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), null),
                        new GpxWaypoint(new GpxLongitude(3), new GpxLatitude(4), null)
                    ]), null),
                    new GpxTrackSegment(new ImmutableGpxWaypointTable([
                        new GpxWaypoint(new GpxLongitude(5), new GpxLatitude(6), null),
                        new GpxWaypoint(new GpxLongitude(7), new GpxLatitude(8), null)
                    ]), null)
                }
            ]));
        var newRouteData = new RouteData
        {
            Segments =
            [
                new RouteSegmentData(),
                new RouteSegmentData(),
                new RouteSegmentData(),
                new RouteSegmentData()
            ]
        };
        _routeDataSplitterService.Split(Arg.Any<RouteData>()).Returns(newRouteData);

        var dataContainer = _converterService.ToDataContainer(gpx.ToBytes(), FlowFormats.GPX).Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
        Assert.AreEqual(FlowFormats.GPX, dataContainer.Routes.First().Name);
        Assert.AreEqual(newRouteData.Segments.Count, dataContainer.Routes.First().Segments.Count);
    }

    [TestMethod]
    public void ConvertGpxToDataContainer_NonSiteFile_ShouldManipulateRouteData()
    {
        var gpx = new GpxFile();
        gpx.Tracks.Add(new GpxTrack().WithName("track").WithSegments(
            [
                ..new[]
                {
                    new GpxTrackSegment(new ImmutableGpxWaypointTable([
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(1), null),
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(1.000001), null),
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(1.000002), null),
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(1.000003), null)
                    ]), null)
                }
            ]));

        var newRouteData = new RouteData
        {
            Segments =
            [
                new RouteSegmentData(),
                new RouteSegmentData()
            ]
        };
        _routeDataSplitterService.Split(Arg.Any<RouteData>()).Returns(newRouteData);

        var dataContainer = _converterService.ToDataContainer(gpx.ToBytes(), FlowFormats.GPX).Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
        Assert.AreEqual(newRouteData.Segments.Count, dataContainer.Routes.First().Segments.Count);
    }

    [TestMethod]
    public void ConvertGpxToDataContainer_NonSiteFileNoPointsInTrack_ShouldManipulateRouteData()
    {
        var gpx = new GpxFile();
        gpx.Routes.Add(new GpxRoute());

        var dataContainer = _converterService.ToDataContainer(gpx.ToBytes(), FlowFormats.GPX).Result;

        Assert.AreEqual(0, dataContainer.Routes.Count);
    }

    [TestMethod]
    public void ConvertGpxToDataContainer_NonSiteFileWithType_ShouldRemoveType()
    {
        var gpx = new GpxFile();
        gpx.Routes.Add(new GpxRoute());
        gpx.Waypoints.Add(new GpxWaypoint(new Coordinate(0,0)).WithClassification("Generic"));

        var dataContainer = _converterService.ToDataContainer(gpx.ToBytes(), FlowFormats.GPX).Result;

        Assert.AreEqual(string.Empty, dataContainer.Routes[0].Markers[0].Type);
    }

    [TestMethod]
    public void ConvertGpxVersion1ToDataContainer_NonSiteFileNoPointsInTrack_ShouldManipulateRouteData()
    {
        string gpxVersion1 = "<?xml version='1.0' encoding='UTF-8'?><gpx version='1.0' creator='GPSBabel - http://www.gpsbabel.org' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns='http://www.topografix.com/GPX/1/0' xsi:schemaLocation='http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd'><rte><rtept lat='33.1187173918366' lon='35.6488631636844'><ele>0.000000</ele><name>A001</name><cmt>60963[1] דרך עפר היוצאת מעיקול בכביש 959 - נקודת ההתחלה</cmt><desc>60963[1] דרך עפר היוצאת מעיקול בכביש 959 - נקודת ההתחלה</desc></rtept></rte></gpx>";
        byte[] bytes = Encoding.UTF8.GetBytes(gpxVersion1);
        var gpx = new GpxFile();
        gpx.Routes.Add(new GpxRoute());
        _gpsBabelGateway.ConvertFileFromat(bytes, Arg.Any<string>(), Arg.Any<string>()).Returns(gpx.ToBytes());

        var dataContainer = _converterService.ToDataContainer(bytes, FlowFormats.GPX).Result;

        Assert.AreEqual(0, dataContainer.Routes.Count);
    }

    [TestMethod]
    public void ConvertGeoJsonToDataContainer_ShouldConvertToDataContainer()
    {
        var collection = new FeatureCollection { new Feature(new Point(new CoordinateZ(1, 2, 3)), new AttributesTable()) };

        var dataContainer = _converterService.ToDataContainer(collection.ToBytes(), FlowFormats.GEOJSON).Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
    }

    [TestMethod]
    public void ConvertTwlToDataContainer_ShouldConvertToDataContainer()
    {
        _gpsBabelGateway.ConvertFileFromat(_randomBytes, Arg.Any<string>(), Arg.Any<string>()).Returns(_simpleGpx.ToBytes());

        var dataContainer = _converterService.ToDataContainer(_randomBytes, FlowFormats.TWL).Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
    }

    [TestMethod]
    [ExpectedException(typeof(AggregateException))]
    public void ConvertCustomToDataContainer_ShouldNotConvertToDataContainerDueToSecurityReasons()
    {
        _gpsBabelGateway.ConvertFileFromat(_randomBytes, "kuku", Arg.Any<string>()).Returns(_simpleGpx.ToBytes());

        _converterService.ToDataContainer(_randomBytes, "kuku").Wait();
    }

    [TestMethod]
    public void ConvertKmzToDataContainer_ShouldConvertToDataContainer()
    {
        var zipfileStream = new MemoryStream();
        using (var zipOutputStream = new ZipOutputStream(zipfileStream))
        {
            ZipEntry entry = new ZipEntry("file.kml");
            zipOutputStream.PutNextEntry(entry);
            new MemoryStream(_randomBytes).CopyTo(zipOutputStream);
            zipOutputStream.CloseEntry();
        }

        _gpsBabelGateway.ConvertFileFromat(Arg.Is<byte[]>(b => b.AsEnumerable().SequenceEqual(_randomBytes)), Arg.Any<string>(), Arg.Any<string>()).Returns(_simpleGpx.ToBytes());

        var dataContainer = _converterService.ToDataContainer(zipfileStream.ToArray(), FlowFormats.KMZ).Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
    }

    [TestMethod]
    public void ConvertGpxGzToDataContainer_ShouldConvertToDataContainer()
    {
        var gpxStream = new MemoryStream(_simpleGpx.ToBytes());
        var compressedGzipStream = new MemoryStream();
        using (var gZipStream = new GZipOutputStream(compressedGzipStream))
        {
            gpxStream.CopyTo(gZipStream);
        }
        var dataContainer = _converterService.ToDataContainer(compressedGzipStream.ToArray(), "file.gpx.gz").Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
    }

    [TestMethod]
    public void ConvertGpxBz2ToDataContainer_ShouldConvertToDataContainer()
    {
        var gpxStream = new MemoryStream(_simpleGpx.ToBytes());
        var compressedBz2Stream = new MemoryStream();
        using (var bzipStream = new BZip2OutputStream(compressedBz2Stream))
        {
            gpxStream.CopyTo(bzipStream);
        }

        var dataContainer = _converterService.ToDataContainer(compressedBz2Stream.ToArray(), "file.gpx.bz2").Result;

        Assert.AreEqual(1, dataContainer.Routes.Count);
    }

    [TestMethod]
    public void ConvertKmzToGeoJson_ShouldConvert()
    {
        var zipfileStream = new MemoryStream();
        using (var zipOutputStream = new ZipOutputStream(zipfileStream))
        {
            ZipEntry entry = new ZipEntry("file.kml");
            zipOutputStream.PutNextEntry(entry);
            new MemoryStream(_randomBytes).CopyTo(zipOutputStream);
            zipOutputStream.CloseEntry();
        }
        _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), FlowFormats.KML_BABEL_FORMAT, FlowFormats.GPX_BABEL_FORMAT).Returns(_simpleGpx.ToBytes());

        var converterd = _converterService.Convert(zipfileStream.ToArray(), "file.kmz", FlowFormats.GEOJSON).Result;

        Assert.AreNotEqual(0, converterd.Length);
    }

    [TestMethod]
    public void ConvertDataContainer_InvalidSinglePointInSegment_ShouldNotFailToConvertToGeoJson()
    {
        var dataContainer = new DataContainerPoco
        {
            Routes =
            [
                new RouteData
                {
                    Segments =
                    [
                        new RouteSegmentData
                        {
                            Latlngs = [new LatLngTime()]
                        }
                    ]
                }
            ]
        };
        var feautreCollection = _converterService.ToAnyFormat(dataContainer, FlowFormats.GEOJSON).Result;
        Assert.IsNotNull(feautreCollection);
    }

    [TestMethod]
    public void CheckIsValid_ShouldReturnFalse()
    {
        Assert.IsFalse(_converterService.IsValidFormat("false"));
    }
        
    [TestMethod]
    public void CheckIsValid_GPX_ShouldReturnTrue()
    {
        Assert.IsTrue(_converterService.IsValidFormat(FlowFormats.GPX));
    }
}