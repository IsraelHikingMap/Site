using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;

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
                Routes = new List<RouteData>
                {
                    new RouteData
                    {
                        Name = "name",
                        Markers = new List<MarkerData> { new MarkerData { Latlng = new LatLng { Lat = 1, Lng = 2 } } },
                        Segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {Latlngs = new List<LatLng> {new LatLng {Lat = 3, Lng = 4, Alt = 5}}}
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

            Assert.AreEqual(0, dataContainer.Routes.Count);
        }

        [TestMethod]
        public void ToDataContainer_RouteWithoutPoints_ShouldReturnRouteWithoutPointsDataContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] { new trkType() }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(0, dataContainer.Routes.Count);
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
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
        }

        [TestMethod]
        public void ToDataContainer_PointsOlny_ShouldReturnRouteWithoutPointsOnlyDataContainer()
        {
            var gpx = new gpxType
            {
                wpt = new[] { new wptType { lat = 4, lon = 5, ele = 6, eleSpecified = true } },
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Segments.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
        }


        [TestMethod]
        public void ToDataContainer_TrackOnlyWithSinglePoint_ShouldReturnEmptyContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] { new trkType { trkseg = new [] { new trksegType { trkpt = new[] { new wptType { lat = 1, lon = 2} } } } } }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Markers.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Segments.Count);
        }

        [TestMethod]
        public void ToDataContainer_TrackOnlyWithTwoPoints_ShouldReturnRouteDataContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] { new trkType { trkseg = new[] { new trksegType { trkpt = new[] { new wptType { lat = 1, lon = 2 }, new wptType { lat = 3, lon = 4 } } } } } }
            };
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Markers.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Segments.Count);
        }

        [TestMethod]
        public void ConvertToGpxAndBack_WithData_ShouldReturnTheSameData()
        {
            var dataContainer = new DataContainer
            {
                Routes = new List<RouteData>
                {
                    new RouteData
                    {
                        Name = "name1",
                        Markers = new List<MarkerData> { new MarkerData { Latlng = new LatLng { Lat = 1, Lng = 2 } } },
                        Segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {
                                Latlngs = new List<LatLng>
                                {
                                    new LatLng {Lat = 3, Lng = 4, Alt = 5},
                                    new LatLng {Lat = 6, Lng = 7, Alt = 8}
                                },
                                RoutePoint = new LatLng { Lat = 6, Lng = 7}
                            }
                        }
                    },
                    new RouteData
                    {
                        Name = "name2",
                        Segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {Latlngs = new List<LatLng>
                            {
                                new LatLng {Lat = 13, Lng = 14, Alt = 15},
                                new LatLng {Lat = 16, Lng = 17, Alt = 18}
                            }}
                        }
                    }
                }
            };

            var gpx = _converter.ToGpx(dataContainer);
            var newDataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(dataContainer.Routes.Count, newDataContainer.Routes.Count);
            Assert.AreEqual(dataContainer.Routes.First().Name, newDataContainer.Routes.First().Name);
            CollectionAssert.AreEqual(dataContainer.Routes.First().Segments.First().Latlngs, newDataContainer.Routes.First().Segments.First().Latlngs);
            Assert.AreEqual(dataContainer.Routes.First().Markers.First().Latlng, newDataContainer.Routes.First().Markers.First().Latlng);
            Assert.AreEqual(dataContainer.Routes.Last().Name, newDataContainer.Routes.Last().Name);
        }
    }
}
