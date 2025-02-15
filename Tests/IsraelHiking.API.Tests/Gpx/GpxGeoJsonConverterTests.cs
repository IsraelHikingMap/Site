using IsraelHiking.API.Converters;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NetTopologySuite.IO;
using System.Collections.Immutable;
using System.Linq;

namespace IsraelHiking.API.Tests.Gpx;

[TestClass]
public class GpxGeoJsonConverterTests
{
    private readonly IGpxGeoJsonConverter _gpxGeoJsonConverter = new GpxGeoJsonConverter(new GeometryFactory());

    [TestMethod]
    public void CovertGeoJsonToGpx_OnlyOnePoint_ShouldBeConverted()
    {
        GpxFile gpx = new GpxFile();
        gpx.Waypoints.Add(new GpxWaypoint((GpxLongitude)1, (GpxLatitude)1).WithName("name"));

        var featureCollection = _gpxGeoJsonConverter.   ToGeoJson(gpx);

        Assert.AreEqual(1, featureCollection.Count);
        var point = featureCollection.Select(f => f.Geometry).OfType<Point>().FirstOrDefault();
        Assert.IsNotNull(point);
        var coordinates = point.Coordinate;
        Assert.IsNotNull(coordinates);
        Assert.AreEqual(gpx.Waypoints[0].Name, featureCollection.First().Attributes[FeatureAttributes.NAME]);
        Assert.IsTrue(double.IsNaN(coordinates.Z));
        Assert.AreEqual(gpx.Waypoints[0].Latitude, coordinates.Y);
        Assert.AreEqual(gpx.Waypoints[0].Longitude, coordinates.X);
    }

    [TestMethod]
    public void CovertTwoWays_OnlyOnePoint_ShouldBeTheSame()
    {
        GpxFile gpx = new GpxFile();
        gpx.Waypoints.Add(new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3));

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
        var gpx = new GpxFile();
        gpx.Routes.Add(new GpxRoute().WithName("route").WithWaypoints([
            new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
            new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), null)
        ]));

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
        var gpx = new GpxFile();
        gpx.Tracks.Add(new GpxTrack().WithName("track").WithSegments(
            [
                ..new[]
                {
                    new GpxTrackSegment(new ImmutableGpxWaypointTable([
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
                        new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6)
                    ]), null),
                    new GpxTrackSegment(new ImmutableGpxWaypointTable([
                        new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6),
                        new GpxWaypoint(new GpxLongitude(14), new GpxLatitude(15), null)
                    ]), null)
                }
            ]));

        var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
        var newGpx = _gpxGeoJsonConverter.ToGpx(featureCollection);

        Assert.AreEqual(1, newGpx.Routes.Count);
        Assert.AreEqual(gpx.Tracks[0].Name, newGpx.Routes[0].Name);
        Assert.AreEqual(3, newGpx.Routes[0].Waypoints.Count);
    }

    [TestMethod]
    public void CovertTwoWays_OnlyOneTrackWithOneSegment_ShouldBeTheSame()
    {
        var gpx = new GpxFile();
        gpx.Tracks.Add(new GpxTrack().WithName("track").WithSegments(
            [
                ..new[]
                {
                    new GpxTrackSegment(new ImmutableGpxWaypointTable([
                        new GpxWaypoint(new GpxLongitude(1), new GpxLatitude(2), 3),
                        new GpxWaypoint(new GpxLongitude(4), new GpxLatitude(5), 6)
                    ]), null)
                }
            ]));

        var featureCollection = _gpxGeoJsonConverter.ToGeoJson(gpx);
            
        Assert.AreEqual(1, featureCollection.Count);
        var lineString = featureCollection.First().Geometry as LineString;
        Assert.IsNotNull(lineString);
        Assert.AreEqual(2, lineString.Coordinates.Length);
    }
}