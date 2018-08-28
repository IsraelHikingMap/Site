using System.Collections.Generic;
using System.Collections.Immutable;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Gpx;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;

namespace IsraelHiking.API.Tests.Gpx
{
    [TestClass]
    public class GpxGeoJsonConverterTests
    {
        private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter = new GpxGeoJsonConverter();

        [TestMethod]
        public void CovertGeoJsonToGpx_OnlyOnePoint_ShouldBeConverted()
        {
            GpxMainObject gpx = new GpxMainObject
            {
                Waypoints = new[]
                {
                    new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), null, null, "name", null, null, null, null,
                        null, null, ImmutableArray<GpxWebLink>.Empty, null, null, null, null, null, null, null, null,
                        null)
                }.ToList()
            };

            var featureCollection = _gpxGeoJsonConverter.   ToGeoJson(gpx);

            Assert.AreEqual(1, featureCollection.Features.Count);
            var point = featureCollection.Features.Select(f => f.Geometry).OfType<Point>().FirstOrDefault();
            Assert.IsNotNull(point);
            var coordinates = point.Coordinate;
            Assert.IsNotNull(coordinates);
            Assert.AreEqual(gpx.Waypoints[0].Name, featureCollection.Features.First().Attributes[FeatureAttributes.NAME]);
            Assert.IsTrue(double.IsNaN(coordinates.Z));
            Assert.AreEqual(gpx.Waypoints[0].Latitude, coordinates.Y);
            Assert.AreEqual(gpx.Waypoints[0].Longitude, coordinates.X);
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOnePoint_ShouldBeTheSame()
        {
            var gpx = new GpxMainObject
            {
                Waypoints = new[] { new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3) }.ToList()
            };

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

            Assert.AreEqual(gpx.Waypoints.Count, newGpx.Waypoints.Count);
            Assert.AreEqual(gpx.Waypoints[0].Name, newGpx.Waypoints[0].Name);
            Assert.AreEqual(gpx.Waypoints[0].ElevationInMeters, newGpx.Waypoints[0].ElevationInMeters);
            Assert.AreEqual(gpx.Waypoints[0].Latitude, newGpx.Waypoints[0].Latitude);
            Assert.AreEqual(gpx.Waypoints[0].Longitude, newGpx.Waypoints[0].Longitude);
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOneRoute_ShouldBeTheSame()
        {
            var gpx = new GpxMainObject
            {
                Routes = new [] { new GpxRoute("route", null, null, null, ImmutableArray<GpxWebLink>.Empty, null,null, 
                    new ImmutableGpxWaypointTable(new [] {
                            new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
                        new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), null),
                        })
                    , null)
                }.ToList()
            };

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

            Assert.AreEqual(gpx.Routes.Count, newGpx.Routes.Count);
            Assert.AreEqual(gpx.Routes[0].Name, newGpx.Routes[0].Name);
            for (int i = 0; i < newGpx.Routes[0].Waypoints.Count; i++)
            {
                Assert.AreEqual(gpx.Routes[0].Waypoints[i].ElevationInMeters, newGpx.Routes[0].Waypoints[i].ElevationInMeters);
                Assert.AreEqual(gpx.Routes[0].Waypoints[i].Latitude.Value, newGpx.Routes[0].Waypoints[i].Latitude.Value);
                Assert.AreEqual(gpx.Routes[0].Waypoints[i].Longitude.Value, newGpx.Routes[0].Waypoints[i].Longitude.Value);
            }
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOneTrack_ShouldBeTheSame()
        {
            var gpx = new GpxMainObject
            {
                Tracks = new List<GpxTrack>
                {
                    new GpxTrack("track", null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null,
                        new[]
                        {
                            new GpxTrackSegment(new ImmutableGpxWaypointTable(new[]
                            {
                                new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
                                new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6)
                            }), null),
                            new GpxTrackSegment(new ImmutableGpxWaypointTable(new[]
                            {
                                new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6),
                                new GpxWaypoint(new GpxLongitude(14), new GpxLatitude(15), null)
                            }), null)
                        }.ToImmutableArray(), null)
                }
            };
            

            var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

            Assert.AreEqual(gpx.Tracks.Count, newGpx.Tracks.Count);
            Assert.AreEqual(gpx.Tracks[0].Name, newGpx.Tracks[0].Name);
            for (int i = 0; i < newGpx.Tracks[0].Segments.Length; i++)
            {
                for (int j = 0; j < newGpx.Tracks[0].Segments[i].Waypoints.Count; j++)
                {
                    Assert.AreEqual(gpx.Tracks[0].Segments[i].Waypoints[j].ElevationInMeters, newGpx.Tracks[0].Segments[i].Waypoints[j].ElevationInMeters);
                    Assert.AreEqual(gpx.Tracks[0].Segments[i].Waypoints[j].Latitude.Value, newGpx.Tracks[0].Segments[i].Waypoints[j].Latitude.Value);
                    Assert.AreEqual(gpx.Tracks[0].Segments[i].Waypoints[j].Longitude.Value, newGpx.Tracks[0].Segments[i].Waypoints[j].Longitude.Value);
                }
            }
        }

        [TestMethod]
        public void CovertTwoWays_OnlyOneTrackWithOneSegment_ShouldBeTheSame()
        {
            var gpx = new GpxMainObject
            {
                Tracks = new List<GpxTrack>
                {
                    new GpxTrack("track", null, null, null, ImmutableArray<GpxWebLink>.Empty, null, null,
                        new[] {
                            new GpxTrackSegment(new ImmutableGpxWaypointTable(new[]
                            {
                                new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
                                new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6)
                            }), null)
                        }.ToImmutableArray(), null)
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
