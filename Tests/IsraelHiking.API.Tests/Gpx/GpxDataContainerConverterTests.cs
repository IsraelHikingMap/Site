using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Tests.Gpx
{
    [TestClass]
    public class GpxDataContainerConverterTests
    {
        private IGpxDataContainerConverter _converter;

        [TestInitialize]
        public void TestInitialize()
        {
            _converter = new GpxDataContainerConverter();
        }

        [TestMethod]
        public void ToGpx_NoData_ShouldReturnEmptyGpx()
        {
            var dataContainer = new DataContainer();

            var gpx = _converter.ToGpx(dataContainer);

            Assert.AreEqual(0, gpx.wpt.Length);
            Assert.AreEqual(0, gpx.rte.Length);
            Assert.AreEqual(0, gpx.trk.Length);
        }

        [TestMethod]
        public void ToGpx_WithData_ShouldReturnFullGpx()
        {
            var dataContainer = new DataContainer
            {
                routes = new List<RouteData>
                {
                    new RouteData
                    {
                        name = "name",
                        markers = new List<MarkerData> { new MarkerData { latlng = new LatLng { lat = 1, lng = 2 } } },
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {latlngs = new List<LatLng> {new LatLng {lat = 3, lng = 4, alt = 5}}}
                        }
                    }
                }
            };

            var gpx = _converter.ToGpx(dataContainer);

            Assert.AreEqual(1, gpx.wpt.Length);
            Assert.AreEqual(1, gpx.wpt[0].lat);
            Assert.AreEqual(2, gpx.wpt[0].lon);
            Assert.AreEqual(0, gpx.rte.Length);
            Assert.AreEqual(1, gpx.trk.Length);
            Assert.AreEqual(1, gpx.trk[0].trkseg.Length);
            Assert.AreEqual(3, gpx.trk[0].trkseg[0].trkpt[0].lat);
            Assert.AreEqual(4, gpx.trk[0].trkseg[0].trkpt[0].lon);
            Assert.AreEqual(5, gpx.trk[0].trkseg[0].trkpt[0].ele);
        }

        [TestMethod]
        public void ToDataContainer_NoData_ShouldReturnEmptyDataContainer()
        {
            var gpx = new gpxType();

            var dataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ToDataContainer_RouteWithoutPoints_ShouldReturnRouteWithoutPointsDataContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] { new trkType() }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ToDataContainer_RouteWithPoints_ShouldReturnRouteWithPointsDataContainer()
        {
            var gpx = new gpxType
            {
                wpt = new [] { new wptType { lat = 4, lon = 5, ele = 6, eleSpecified = true} },
                rte = new[] { new rteType { rtept = new [] { new wptType { lat = 1, lon = 2, ele = 3, eleSpecified = true} } } }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(1, dataContainer.routes.First().markers.Count);
        }

        [TestMethod]
        public void ToDataContainer_PointsOlny_ShouldReturnRouteWithoutPointsOnlyDataContainer()
        {
            var gpx = new gpxType
            {
                wpt = new[] { new wptType { lat = 4, lon = 5, ele = 6, eleSpecified = true } },
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(0, dataContainer.routes.First().segments.Count);
            Assert.AreEqual(1, dataContainer.routes.First().markers.Count);
        }


        [TestMethod]
        public void ToDataContainer_TrackOnlyWithSinglePoint_ShouldReturnEmptyContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] { new trkType { trkseg = new [] { new trksegType { trkpt = new[] { new wptType { lat = 1, lon = 2} } } } } }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(0, dataContainer.routes.First().markers.Count);
            Assert.AreEqual(0, dataContainer.routes.First().segments.Count);
        }

        [TestMethod]
        public void ToDataContainer_TrackOnlyWithTwoPoints_ShouldReturnRouteDataContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] { new trkType { trkseg = new[] { new trksegType { trkpt = new[] { new wptType { lat = 1, lon = 2 }, new wptType { lat = 3, lon = 4 } } } } } }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.routes.Count);
            Assert.AreEqual(0, dataContainer.routes.First().markers.Count);
            Assert.AreEqual(1, dataContainer.routes.First().segments.Count);
        }

        [TestMethod]
        public void ConvertToGpxAndBack_WithData_ShouldReturnTheSameData()
        {
            var dataContainer = new DataContainer
            {
                routes = new List<RouteData>
                {
                    new RouteData
                    {
                        name = "name1",
                        markers = new List<MarkerData> { new MarkerData { latlng = new LatLng { lat = 1, lng = 2 } } },
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {
                                latlngs = new List<LatLng>
                                {
                                    new LatLng {lat = 3, lng = 4, alt = 5},
                                    new LatLng {lat = 6, lng = 7, alt = 8}
                                },
                                routePoint = new LatLng { lat = 6, lng = 7}
                            }
                        }
                    },
                    new RouteData
                    {
                        name = "name2",
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {latlngs = new List<LatLng>
                            {
                                new LatLng {lat = 13, lng = 14, alt = 15},
                                new LatLng {lat = 16, lng = 17, alt = 18}
                            }}
                        }
                    }
                }
            };

            var gpx = _converter.ToGpx(dataContainer);
            var newDataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(dataContainer.routes.Count, newDataContainer.routes.Count);
            Assert.AreEqual(dataContainer.routes.First().name, newDataContainer.routes.First().name);
            CollectionAssert.AreEqual(dataContainer.routes.First().segments.First().latlngs, newDataContainer.routes.First().segments.First().latlngs);
            Assert.AreEqual(dataContainer.routes.First().markers.First().latlng, newDataContainer.routes.First().markers.First().latlng);
            Assert.AreEqual(dataContainer.routes.Last().name, newDataContainer.routes.Last().name);
        }
    }
}
