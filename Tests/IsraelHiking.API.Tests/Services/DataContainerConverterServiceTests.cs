using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using Ionic.Zip;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class DataContainerConverterServiceTests
    {
        private IDataContainerConverterService _converterService;
        private IGpsBabelGateway _gpsBabelGateway;
        private byte[] _randomBytes;
        private gpxType _simpleGpx;

        [TestInitialize]
        public void TestInitialize()
        {
            _randomBytes = new byte[] { 0, 1, 1, 0 };
            _simpleGpx = new gpxType { wpt = new[] { new wptType() } };
            _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
            _converterService = new DataContainerConverterService(_gpsBabelGateway, new GpxGeoJsonConverter(), new GpxDataContainerConverter(), new RouteDataSplitterService(new CoordinatesConverter(), new DouglasPeuckerReductionService()));
        }

        [TestMethod]
        public void ConvertDataContainerToGpx_ShouldConvertToGpx()
        {
            var dataContainer = new DataContainer();

            var results = _converterService.ToAnyFormat(dataContainer, "gpx").Result.ToGpx();

            Assert.IsNull(results.wpt);
            Assert.IsNull(results.rte);
            Assert.IsNull(results.trk);
        }

        [TestMethod]
        public void ConvertDataContainerToGeoJson_ShouldConvertToGeoJson()
        {
            var dataContainer = new DataContainer { markers = new List<MarkerData> { new MarkerData { latlng = new LatLng() } } };
            var results = _converterService.ToAnyFormat(dataContainer, "geojson").Result.ToFeatureCollection();

            Assert.AreEqual(1, results.Features.Count);
        }

        [TestMethod]
        public void ConvertDataContainerToKml_ShouldConvertToKmlUsingGpsBabel()
        {
            var datacContainer = new DataContainer();
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(_randomBytes));

            var results = _converterService.ToAnyFormat(datacContainer, "kml").Result;

            CollectionAssert.AreEqual(_randomBytes, results);
        }

        [TestMethod]
        public void ConvertDataContainerToGpxSingleTrack_ShouldConvertToGpxUsingGpsBabelAndThenToGpxSingleTrack()
        {
            var datacContainer = new DataContainer
            {
                routes = new List<RouteData>
                {
                    new RouteData
                    {
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData
                            {
                                latlngzs = new List<LatLngZ>
                                {
                                    new LatLngZ {lat = 1, lng = 2},
                                    new LatLngZ {lat = 3, lng = 4}
                                }
                            },
                            new RouteSegmentData
                            {
                                latlngzs = new List<LatLngZ>
                                {
                                    new LatLngZ {lat = 5, lng = 6},
                                    new LatLngZ {lat = 7, lng = 8}
                                }
                            }
                        }
                    }
                }
            };

            var results = _converterService.ToAnyFormat(datacContainer, "gpx_single_track").Result;
            var gpx = results.ToGpx();

            Assert.AreEqual(1, gpx.trk.Length);
            Assert.AreEqual(1, gpx.trk.First().trkseg.Length);
            Assert.AreEqual(1, gpx.trk.First().trkseg.First().trkpt.First().lat);
            Assert.AreEqual(8, gpx.trk.First().trkseg.First().trkpt.Last().lon);
        }

        [TestMethod]
        public void ConvertGpxToDataContainer_ShouldConvertToDataContainer()
        {
            var results = _converterService.ToDataContainer(_simpleGpx.ToBytes(), "gpx").Result;

            Assert.AreEqual(1, results.markers.Count);
            Assert.AreEqual(0, results.routes.Count);
        }


        [TestMethod]
        public void ConvertGpxToDataContainer_NonSiteFile_ShouldManipulateRouteData()
        {
            var gpxToConvert = new gpxType
            {
                trk = new[] { new trkType {
                trkseg = new[]
                {
                    new trksegType
                    {
                        trkpt = new[]
                        {
                            new wptType {lat = 1, lon = 2},
                            new wptType {lat = 3, lon = 4}
                        }
                    },
                    new trksegType
                    {
                        trkpt = new[]
                        {
                            new wptType {lat = 5, lon = 6},
                            new wptType {lat = 7, lon = 8}
                        }
                    }
                }
            }}
            };

            var dataContainer = _converterService.ToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(4, dataContainer.routes.First().segments.Count);
        }

        [TestMethod]
        public void ConvertGpxToDataContainer_NonSiteFileShortTrack_ShouldManipulateRouteData()
        {
            var gpxToConvert = new gpxType
            {
                trk = new[] { new trkType {
                trkseg = new[]
                {
                    new trksegType
                    {
                        trkpt = new[]
                        {
                            new wptType {lat = 1, lon = 1},
                            new wptType {lat = 1, lon = 1.000001M},
                            new wptType {lat = 1, lon = 1.000002M},
                            new wptType {lat = 1, lon = 1.000003M}
                        }
                    }
                }
            }}
            };

            var dataContainer = _converterService.ToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(2, dataContainer.routes.First().segments.Count);
        }

        [TestMethod]
        public void ConvertGpxToDataContainer_NonSiteFileNoPointsInTrack_ShouldManipulateRouteData()
        {
            var gpxToConvert = new gpxType { rte = new[] { new rteType { rtept = new wptType[0] } } };

            var dataContainer = _converterService.ToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ConvertGpxVersion1ToDataContainer_NonSiteFileNoPointsInTrack_ShouldManipulateRouteData()
        {
            string gpxVersion1 = "<?xml version='1.0' encoding='UTF-8'?><gpx version='1.0' creator='GPSBabel - http://www.gpsbabel.org' xmlns:xsi='http://www.w3.org/2001/XMLSchema-instance' xmlns='http://www.topografix.com/GPX/1/0' xsi:schemaLocation='http://www.topografix.com/GPX/1/0 http://www.topografix.com/GPX/1/0/gpx.xsd'><rte><rtept lat='33.1187173918366' lon='35.6488631636844'><ele>0.000000</ele><name>A001</name><cmt>60963[1] דרך עפר היוצאת מעיקול בכביש 959 - נקודת ההתחלה</cmt><desc>60963[1] דרך עפר היוצאת מעיקול בכביש 959 - נקודת ההתחלה</desc></rtept></rte></gpx>";
            byte[] bytes = Encoding.UTF8.GetBytes(gpxVersion1);
            var gpx = new gpxType { rte = new[] { new rteType { rtept = new wptType[0] } } };
            _gpsBabelGateway.ConvertFileFromat(bytes, Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(gpx.ToBytes()));

            var dataContainer = _converterService.ToDataContainer(bytes, "gpx").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ConvertGeoJsonToDataContainer_ShouldConvertToDataContainer()
        {
            var collection = new FeatureCollection { Features = { new Feature(new Point(new Coordinate(1, 2, 3)), new AttributesTable()) } };

            var dataContainer = _converterService.ToDataContainer(collection.ToBytes(), "geojson").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.markers.Count);
        }

        [TestMethod]
        public void ConvertTwlToDataContainer_ShouldConvertToDataContainer()
        {
            _gpsBabelGateway.ConvertFileFromat(_randomBytes, Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(_simpleGpx.ToBytes()));

            var dataContainer = _converterService.ToDataContainer(_randomBytes, "twl").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.markers.Count);
        }

        [TestMethod]
        public void ConvertCustomToDataContainer_ShouldConvertToDataContainer()
        {
            _gpsBabelGateway.ConvertFileFromat(_randomBytes, "kuku", Arg.Any<string>()).Returns(Task.FromResult(_simpleGpx.ToBytes()));

            var dataContainer = _converterService.ToDataContainer(_randomBytes, "kuku").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.markers.Count);
        }

        [TestMethod]
        public void ConvertKmzToDataContainer_ShouldConvertToDataContainer()
        {
            var zipfileStream = new MemoryStream();
            ZipFile file = new ZipFile();
            file.AddEntry("file.kml", new MemoryStream(_randomBytes));
            file.Save(zipfileStream);
            _gpsBabelGateway.ConvertFileFromat(Arg.Is<byte[]>(b => b.AsEnumerable().SequenceEqual(_randomBytes)), Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(_simpleGpx.ToBytes()));

            var dataContainer = _converterService.ToDataContainer(zipfileStream.ToArray(), "kmz").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.markers.Count);
        }

        [TestMethod]
        public void ConvertGpxGzToDataContainer_ShouldConvertToDataContainer()
        {
            var gpxStream = new MemoryStream(_simpleGpx.ToBytes());
            var compressedGzipStream = new MemoryStream();
            using (var gZipStream = new GZipStream(compressedGzipStream, CompressionMode.Compress))
            {
                gpxStream.CopyTo(gZipStream);
            }
            var dataContainer = _converterService.ToDataContainer(compressedGzipStream.ToArray(), "file.gpx.gz").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.markers.Count);
        }
    }
}
