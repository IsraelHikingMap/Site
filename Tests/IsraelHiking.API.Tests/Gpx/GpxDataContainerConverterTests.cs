using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
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

            Assert.AreEqual(0, gpx.Waypoints.Count);
            Assert.AreEqual(0, gpx.Routes.Count);
            Assert.AreEqual(0, gpx.Tracks.Count);
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

            Assert.AreEqual(1, gpx.Waypoints.Count);
            Assert.AreEqual(1.0, gpx.Waypoints[0].Latitude);
            Assert.AreEqual(2.0, gpx.Waypoints[0].Longitude);
            Assert.AreEqual(0, gpx.Routes.Count);
            Assert.AreEqual(1, gpx.Tracks.Count);
            Assert.AreEqual(1, gpx.Tracks[0].Segments.Length);
            Assert.AreEqual(3.0, gpx.Tracks[0].Segments[0].Waypoints[0].Latitude);
            Assert.AreEqual(4.0, gpx.Tracks[0].Segments[0].Waypoints[0].Longitude);
            Assert.AreEqual(5, gpx.Tracks[0].Segments[0].Waypoints[0].ElevationInMeters);
        }

        [TestMethod]
        public void ToDataContainer_NoData_ShouldReturnEmptyDataContainer()
        {
            var gpx = new GpxFile();

            var dataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(0, dataContainer.Routes.Count);
        }

        [TestMethod]
        public void ToDataContainer_RouteWithoutPoints_ShouldReturnRouteWithoutPointsDataContainer()
        {
            var gpx = new GpxFile();
            gpx.Tracks.Add(new GpxTrack());
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(0, dataContainer.Routes.Count);
        }

        [TestMethod]
        public void ToDataContainer_RouteWithPoints_ShouldReturnRouteWithPointsDataContainer()
        {
            var gpx = new GpxFile();
            gpx.Waypoints.Add(new GpxWaypoint(new GpxLongitude(5), new GpxLatitude(4), 6));
            gpx.Routes.Add(new GpxRoute().WithWaypoints(new[] { new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3) }));

            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
        }

        [TestMethod]
        public void ToDataContainer_PointsOlny_ShouldReturnRouteWithoutPointsOnlyDataContainer()
        {
            var gpx = new GpxFile();
            gpx.Waypoints.Add(new GpxWaypoint(new GpxLongitude(5), new GpxLatitude(4), 6));
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Segments.Count);
            Assert.AreEqual(1, dataContainer.Routes.First().Markers.Count);
        }


        [TestMethod]
        public void ToDataContainer_TrackOnlyWithSinglePoint_ShouldReturnEmptyContainer()
        {
            var gpx = new GpxFile();
            gpx.Tracks.Add(new GpxTrack().WithSegments(new[]
            {
                new GpxTrackSegment(new ImmutableGpxWaypointTable(new [] { new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3) }), null)
            }.ToImmutableArray()));
            var dataContainer = _converter.ToDataContainer(gpx);
            Assert.AreEqual(1, dataContainer.Routes.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Markers.Count);
            Assert.AreEqual(0, dataContainer.Routes.First().Segments.Count);
        }

        [TestMethod]
        public void ToDataContainer_TrackOnlyWithTwoPoints_ShouldReturnRouteDataContainer()
        {
            var gpx = new GpxFile();
            gpx.Tracks.Add(new GpxTrack().WithSegments(new[]
            {
                new GpxTrackSegment(new ImmutableGpxWaypointTable(new[]
                {
                    new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
                    new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6)
                }), null)
            }.ToImmutableArray()));
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
                        Color = "color",
                        Opacity = 0.5,
                        Weight = 7,
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
            gpx = gpx.ToBytes().ToGpx();
            var newDataContainer = _converter.ToDataContainer(gpx);

            Assert.AreEqual(dataContainer.Routes.Count, newDataContainer.Routes.Count);
            Assert.AreEqual(dataContainer.Routes.First().Name, newDataContainer.Routes.First().Name);
            Assert.AreEqual(dataContainer.Routes.First().Opacity, newDataContainer.Routes.First().Opacity);
            Assert.AreEqual(dataContainer.Routes.First().Color, newDataContainer.Routes.First().Color);
            Assert.AreEqual(dataContainer.Routes.First().Weight, newDataContainer.Routes.First().Weight);
            CollectionAssert.AreEqual(dataContainer.Routes.First().Segments.First().Latlngs, newDataContainer.Routes.First().Segments.First().Latlngs);
            Assert.AreEqual(dataContainer.Routes.First().Markers.First().Latlng, newDataContainer.Routes.First().Markers.First().Latlng);
            Assert.AreEqual(dataContainer.Routes.Last().Name, newDataContainer.Routes.Last().Name);
            Assert.IsNull(newDataContainer.Routes.Last().Opacity);
            Assert.IsTrue(string.IsNullOrWhiteSpace(newDataContainer.Routes.Last().Color));
            Assert.IsNull(newDataContainer.Routes.Last().Weight);
        }
    }
}
