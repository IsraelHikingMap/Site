using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx.GpxTypes;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Gpx
{
    [TestClass]
    public class GpxGeoJsonConverterTests
    {
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter = new GpxGeoJsonConverter();

        [TestMethod]
        public void CovertGeoJsonToGpx_OnlyOnePoint_ShouldBeConverted()
        {
            gpxType gpx = new gpxType
            {
                wpt = new[] {new wptType {lat = 1, lon = 2, ele = 3, eleSpecified = false, name = "point"}}
            };

            var featureCollection = _gpxGeoJsonConverter.   ToGeoJson(gpx);

            Assert.AreEqual(1, featureCollection.Features.Count);
            var point = featureCollection.Features.Select(f => f.Geometry).OfType<Point>().FirstOrDefault();
            Assert.IsNotNull(point);
            var coordinates = point.Coordinate;
            Assert.IsNotNull(coordinates);
            Assert.AreEqual(gpx.wpt[0].name, featureCollection.Features.First().Attributes["name"]);
            Assert.IsTrue(double.IsNaN(coordinates.Z));
            Assert.AreEqual(gpx.wpt[0].lat, (decimal)coordinates.Y);
            Assert.AreEqual(gpx.wpt[0].lon, (decimal)coordinates.X);
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOnePoint_ShouldBeTheSame()
        {
            gpxType gpx = new gpxType
            {
                wpt = new[] { new wptType { lat = 1, lon = 2, ele = 3, eleSpecified = true, name = "point" } }
            };

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

            Assert.AreEqual(gpx.wpt.Length, newGpx.wpt.Length);
            Assert.AreEqual(gpx.wpt[0].name, newGpx.wpt[0].name);
            Assert.AreEqual(gpx.wpt[0].ele, newGpx.wpt[0].ele);
            Assert.AreEqual(gpx.wpt[0].lat, newGpx.wpt[0].lat);
            Assert.AreEqual(gpx.wpt[0].lon, newGpx.wpt[0].lon);
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOneRoute_ShouldBeTheSame()
        {
            gpxType gpx = new gpxType
            {
                rte = new [] { new rteType { name = "route", rtept = new[]
                {
                    new wptType { lat = 1, lon = 2, ele = 3, eleSpecified = true },
                    new wptType { lat = 4, lon = 5 }
                } } },
            };

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

            Assert.AreEqual(gpx.rte.Length, newGpx.rte.Length);
            Assert.AreEqual(gpx.rte[0].name, newGpx.rte[0].name);
            for (int i = 0; i < newGpx.rte[0].rtept.Length; i++)
            {
                Assert.AreEqual(gpx.rte[0].rtept[i].ele, newGpx.rte[0].rtept[i].ele);
                Assert.AreEqual(gpx.rte[0].rtept[i].lat, newGpx.rte[0].rtept[i].lat);
                Assert.AreEqual(gpx.rte[0].rtept[i].lon, newGpx.rte[0].rtept[i].lon);
            }
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOneTrack_ShouldBeTheSame()
        {
            gpxType gpx = new gpxType
            {
                trk = new[]
                {
                    new trkType
                    {
                        name = "tarck",
                        trkseg = new[]
                        {
                            new trksegType
                            {
                                trkpt = new[]
                                {
                                    new wptType {lat = 1, lon = 2, ele = 3, eleSpecified = true},
                                    new wptType {lat = 4, lon = 5, ele = 6, eleSpecified = true}
                                }
                            },
                            new trksegType
                            {
                                trkpt = new[]
                                {
                                    new wptType {lat = 11, lon = 12, ele = 13, eleSpecified = true},
                                    new wptType {lat = 14, lon = 15}
                                }
                            }
                        }
                    }
                }
            };
            

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

            Assert.AreEqual(gpx.trk.Length, newGpx.trk.Length);
            Assert.AreEqual(gpx.trk[0].name, newGpx.trk[0].name);
            for (int i = 0; i < newGpx.trk[0].trkseg.Length; i++)
            {
                for (int j = 0; j < newGpx.trk[0].trkseg[i].trkpt.Length; j++)
                {
                    Assert.AreEqual(gpx.trk[0].trkseg[i].trkpt[j].ele, newGpx.trk[0].trkseg[i].trkpt[j].ele);
                    Assert.AreEqual(gpx.trk[0].trkseg[i].trkpt[j].lat, newGpx.trk[0].trkseg[i].trkpt[j].lat);
                    Assert.AreEqual(gpx.trk[0].trkseg[i].trkpt[j].lon, newGpx.trk[0].trkseg[i].trkpt[j].lon);
                }
            }
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOneTrackWithOneSegment_ShouldBeTheSame()
        {
            gpxType gpx = new gpxType
            {
                trk = new[]
                {
                    new trkType
                    {
                        name = "tarck",
                        trkseg = new[]
                        {
                            new trksegType
                            {
                                trkpt = new[]
                                {
                                    new wptType {lat = 1, lon = 2, ele = 3, eleSpecified = true},
                                    new wptType {lat = 4, lon = 5, ele = 6, eleSpecified = true}
                                }
                            },
                        }
                    }
                }
            };

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            
            Assert.AreEqual(1, featureCollection.Features.Count);
            var lineString = featureCollection.Features.First().Geometry as LineString;
            Assert.IsNotNull(lineString);
            Assert.AreEqual(2, lineString.Coordinates.Length);
        }
    }
}
