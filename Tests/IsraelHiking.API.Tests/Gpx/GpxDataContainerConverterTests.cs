using System;
using System.Collections.Generic;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Gpx.GpxTypes;
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
                markers = new List<MarkerData> { new MarkerData {  latlng = new LatLng { lat = 1, lng = 2} } },
                routes = new List<RouteData> { new RouteData { name = "name", segments = new List<RouteSegmentData>
                {
                    new RouteSegmentData {latlngzs = new List<LatLngZ> {  new LatLngZ {  lat = 3, lng = 4, z = 5} }}
                } } }
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

            Assert.AreEqual(0, dataContainer.markers.Count);
            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ToDataContainer_RouteWithoutPoints_ShouldReturnRouteWithoutPointsDataContainer()
        {
            var gpx = new gpxType
            {
                trk = new[] {new trkType()}
            };
            var dataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(0, dataContainer.markers.Count);
            Assert.AreEqual(0, dataContainer.routes.Count);
        }

        [TestMethod]
        public void ConvertTpGpxAndBack_WithData_ShouldReturnTheSameData()
        {
            var dataContainer = new DataContainer
            {
                markers = new List<MarkerData> {new MarkerData {latlng = new LatLng {lat = 1, lng = 2}}},
                routes = new List<RouteData>
                {
                    new RouteData
                    {
                        name = "name",
                        segments = new List<RouteSegmentData>
                        {
                            new RouteSegmentData {latlngzs = new List<LatLngZ>
                            {
                                new LatLngZ {lat = 3, lng = 4, z = 5},
                                new LatLngZ {lat = 6, lng = 7, z = 8}
                            }}
                        }
                    }
                }
            };

            var gpx = _converter.ToGpx(dataContainer);
            var newDataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(dataContainer.markers.Count, newDataContainer.markers.Count);
            Assert.AreEqual(dataContainer.markers[0].latlng, newDataContainer.markers[0].latlng);
            Assert.AreEqual(dataContainer.routes.Count, newDataContainer.routes.Count);
            Assert.AreEqual(dataContainer.routes[0].name, newDataContainer.routes[0].name);
            CollectionAssert.AreEqual(dataContainer.routes[0].segments[0].latlngzs, newDataContainer.routes[0].segments[0].latlngzs);
        }
    }
}
