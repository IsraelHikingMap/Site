using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using GeoJSON.Net.Feature;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
using IsraelHiking.API.Services;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class FileConversionServiceTests
    {
        private IFileConversionService _service;
        private IGpxGeoJsonConverter _gpxGeoJsonConverter;
        private IGpsBabelGateway _gpsBabelGateway;
        private byte[] _randomBytes;

        [TestInitialize]
        public void TestInitialize()
        {
            _randomBytes = new byte[] { 0, 1, 1, 0 };
            _gpxGeoJsonConverter = Substitute.For<IGpxGeoJsonConverter>();
            _gpsBabelGateway = Substitute.For<IGpsBabelGateway>();
            _service = new FileConversionService(_gpsBabelGateway, _gpxGeoJsonConverter, new GpxDataContainerConverter(), new CoordinatesConverter());
        }

        [TestMethod]
        public void Convert_InputAndOutputAreTheSame_ShouldReturnInputContent()
        {
            var results = _service.Convert(_randomBytes, "gpx", "gpx").Result;

            CollectionAssert.AreEqual(_randomBytes, results);
        }

        [TestMethod]
        public void Convert_InputIsGeoJsonOutputIsGpx_ShouldConvertToGpxAndReturn()
        {
            var gpx = new gpxType();
            var featureCollection = new FeatureCollection();
            _gpxGeoJsonConverter.ToGpx(Arg.Any<FeatureCollection>()).Returns(gpx);

            var results = _service.Convert(featureCollection.ToBytes(), "geojson", "gpx").Result;

            CollectionAssert.AreEqual(gpx.ToBytes(), results);
        }

        [TestMethod]
        public void Convert_InputIsGpxOutputIsKml_ShouldConvertToKmlUsingGpsBabel()
        {
            _gpsBabelGateway.ConvertFileFromat(_randomBytes, Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(_randomBytes));

            var results = _service.Convert(_randomBytes, "gpx", "kml").Result;

            CollectionAssert.AreEqual(_randomBytes, results);
        }

        [TestMethod]
        public void Convert_InputIsGpxOutputIsGeoJson_ShouldConvertToGpxUsingGpsBabelAndThenToGeoJson()
        {
            var gpx = new gpxType();
            var  featureCollection = new FeatureCollection();
            _gpsBabelGateway.ConvertFileFromat(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(Task.FromResult(gpx.ToBytes()));
            _gpxGeoJsonConverter.ToGeoJson(Arg.Any<gpxType>()).Returns(featureCollection);

            var results = _service.Convert(gpx.ToBytes(), "gpx", "geojson").Result;

            CollectionAssert.AreEqual(featureCollection.ToBytes(), results);
        }

        [TestMethod]
        public void Convert_InputIsGpxOutputIsGpxSingleTrack_ShouldConvertToGpxUsingGpsBabelAndThenToGpxSingleTrack()
        {
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

            _gpsBabelGateway.ConvertFileFromat(_randomBytes, Arg.Is<string>(x => x.Contains("gpx")), Arg.Is<string>(x => x.Contains("gpx"))).Returns(Task.FromResult(gpxToConvert.ToBytes()));

            var results = _service.Convert(_randomBytes, "gpx", "gpx_single_track").Result;
            var gpx = results.ToGpx();

            Assert.AreEqual(2, gpx.trk.Length);
            Assert.AreEqual(1, gpx.trk.Last().trkseg.Length);
            Assert.AreEqual(5, gpx.trk.Last().trkseg.First().trkpt.First().lat);
            Assert.AreEqual(8, gpx.trk.Last().trkseg.First().trkpt.Last().lon);
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

            var dataContainer = _service.ConvertAnyFormatToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

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

            var dataContainer = _service.ConvertAnyFormatToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(2, dataContainer.routes.First().segments.Count);
        }

        [TestMethod]
        public void ConvertGpxToDataContainer_NonSiteFileNoPointsInTrack_ShouldManipulateRouteData()
        {
            var gpxToConvert = new gpxType { rte = new [] {  new rteType {  rtept = new wptType[0]} }};

            var dataContainer = _service.ConvertAnyFormatToDataContainer(gpxToConvert.ToBytes(), "gpx").Result;

            Assert.AreEqual(0, dataContainer.routes.Count);
        }
    }
}
