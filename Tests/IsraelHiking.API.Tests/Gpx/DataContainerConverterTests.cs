using System.Linq;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Gpx
{
    [TestClass]
    public class DataContainerConverterTests
    {
        private IDataContainerConverterService _converterService;
        private IGpsBabelGateway _gpsBabelGateway;
        private byte[] _randomBytes;

        [TestInitialize]
        public void TestInitialize()
        {
            _randomBytes = new byte[] { 0, 1, 1, 0 };
            _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
            _converterService = new DataContainerConverterService(_gpsBabelGateway, new GpxGeoJsonConverter(), new GpxDataContainerConverter(), new CoordinatesConverter());
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
            var dataContainer = new DataContainer();
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(new gpxType().ToBytes()));
            var results = _converterService.ToAnyFormat(dataContainer, "geojson").Result.ToFeatureCollection();

            Assert.AreEqual(0, results.Features.Count);
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
            var datacContainer = new DataContainer();
            var gpxToConvert = new gpxType
            {
                trk = new[]
                {
                    new trkType {trkseg = new[]
                    {
                        new trksegType {trkpt = new[] {new wptType {lat = 1, lon = 2}}},
                        new trksegType {trkpt = new[] {new wptType {lat = 3, lon = 4}}}
                    }},
                    new trkType {trkseg = new[]
                    {
                        new trksegType {trkpt = new[] {new wptType {lat = 5, lon = 6}}},
                        new trksegType {trkpt = new[] {new wptType {lat = 7, lon = 8}}}
                    }}
                }
            };

            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), Arg.Is<string>(x => x.Contains("gpx")), Arg.Is<string>(x => x.Contains("gpx"))).Returns(Task.FromResult(gpxToConvert.ToBytes()));

            var results = _converterService.ToAnyFormat(datacContainer, "gpx_single_track").Result;
            var gpx = results.ToGpx();

            Assert.AreEqual(2, gpx.trk.Length);
            Assert.AreEqual(1, gpx.trk.Last().trkseg.Length);
            Assert.AreEqual(5, gpx.trk.Last().trkseg.First().trkpt.First().lat);
            Assert.AreEqual(8, gpx.trk.Last().trkseg.First().trkpt.Last().lon);
        }

        [TestMethod]
        public void ConvertGpxToDataContainer_ShouldConvertToDataContainer()
        {
            var results = _converterService.ToDataContainer(new gpxType().ToBytes(), "gpx").Result;

            Assert.AreEqual(0, results.markers.Count);
            Assert.AreEqual(0, results.routes.Count);
        }

        
        [TestMethod]
        public void ConvertGpxToDataContainer_NonSiteFile_ShouldManipulateRouteData()
        {
            var gpxToConvert = new gpxType { trk = new[] { new trkType {
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
            }}};

            var dataContainer = _converterService.ToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(5, dataContainer.routes.First().segments.Count);
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
            }}};

            var dataContainer = _converterService.ToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(2, dataContainer.routes.First().segments.Count);
        }

        [TestMethod]
        public void ConvertGpxToDataContainer_NonSiteFileNoPointsInTrack_ShouldManipulateRouteData()
        {
            var gpxToConvert = new gpxType { rte = new [] {  new rteType {  rtept = new wptType[0]} }};

            var dataContainer = _converterService.ToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ConvertGeoJsonToDataContainer_ShouldConvertToDataContainer()
        {
            var collection = new FeatureCollection();

            var dataContainer = _converterService.ToDataContainer(collection.ToBytes(), "geojson").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ConvertKmlToDataContainer_ShouldConvertToDataContainer()
        {
            _gpsBabelGateway.ConvertFileFromat(_randomBytes, Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(new gpxType().ToBytes()));

            var dataContainer = _converterService.ToDataContainer(_randomBytes, "twl").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
        }
    }
}
