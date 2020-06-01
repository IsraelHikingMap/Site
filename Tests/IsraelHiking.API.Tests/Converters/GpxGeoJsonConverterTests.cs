using IsraelHiking.API.Converters;
using IsraelHiking.Common;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Tests.Converters
{
    [TestClass]
    public class GpxGeoJsonConverterTests
    {
        [TestMethod]
        public void ToGpx_WithAllTypesOffeatures_ShouldBeConverted()
        {
            var converter = new GpxGeoJsonConverter(new GeometryFactory());
            var geojson = new FeatureCollection();
            var table = new AttributesTable
            {
                {FeatureAttributes.NAME, FeatureAttributes.NAME}
            };
            geojson.Add(new Feature(new Point(new Coordinate(1, 1)), table));
            geojson.Add(new Feature(new MultiPoint(new[] { new Point(new Coordinate(2,2))}), table));
            geojson.Add(new Feature(new Polygon(new LinearRing(new [] { new Coordinate(3,3), new Coordinate(4,4), new Coordinate(5,5), new Coordinate(3,3) })), table));
            geojson.Add(new Feature(new LineString(new[] { new Coordinate(6, 6), new Coordinate(7, 7) }), table));
            geojson.Add(new Feature(new MultiPolygon(new Polygon[] { new Polygon(new LinearRing(new [] { new Coordinate(8,8), new Coordinate(9, 9), new Coordinate(10, 10), new Coordinate(8, 8) }))}), table));
            geojson.Add(new Feature(new MultiLineString(new LineString[]
            {
                new LineString(new[] { new Coordinate(11, 11), new Coordinate(12, 12)}),
                new LineString(new[] { new Coordinate(12, 12), new Coordinate(13, 13)}),
                new LineString(new[] { new Coordinate(14, 14), new Coordinate(15, 15)}),
            }), table));

            var gpx = converter.ToGpx(geojson);

            Assert.AreEqual(2, gpx.Waypoints.Count);
            Assert.AreEqual(3, gpx.Routes.Count);
            Assert.AreEqual(2, gpx.Tracks.Count);
            Assert.AreNotEqual(gpx.Tracks[0].Name, gpx.Tracks[1].Name);
            Assert.AreEqual(FeatureAttributes.NAME + " 1", gpx.Tracks[1].Name);
        }
    }
}
