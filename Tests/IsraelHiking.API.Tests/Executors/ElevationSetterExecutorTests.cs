using System.Linq;
using IsraelHiking.API.Executors;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class ElevationSetterExecutorTests
{
    private IElevationSetterExecutor _executor;
    private IElevationGateway _elevationGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _elevationGateway = Substitute.For<IElevationGateway>();
        _elevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(info => Enumerable.Repeat(1.0, info.Arg<Coordinate[]>().Length).ToArray());
        _elevationGateway.GetElevation(Arg.Any<Coordinate>()).Returns(1.0);
        _executor = new ElevationSetterExecutor(_elevationGateway);
    }

    [TestMethod]
    public void AddElevationToGeometryCollection()
    {
        var polygon = new Polygon(
            new LinearRing(new[]
                { new Coordinate(0, 0), new Coordinate(2, 2), new Coordinate(3, 3), new Coordinate(0, 0) }
            ), new []
            {
                new LinearRing(new[]
                    { new Coordinate(1, 1), new Coordinate(1.1, 1.1), new Coordinate(1.2, 1.2), new Coordinate(1, 1) }
                )   
            }); 
        var collection = new FeatureCollection {
            new Feature(new GeometryCollection(new Geometry[]
            {
                new Point(0,0),
                new LineString(new [] { new Coordinate(0,0), new Coordinate(2,2)}),
                polygon,
                new MultiPoint(new [] { new Point(3, 3), new Point(4,4)}),
                new MultiLineString(new [] { new LineString(new []{ new Coordinate(5,5), new Coordinate(6,6)})}),
                new MultiPolygon(new []{ polygon })
            }), new AttributesTable())
        };
        
        
        _executor.GeometryTo3D(collection.ToArray());
        Assert.IsTrue(collection.ToArray().SelectMany(f => f.Geometry.Coordinates).All(c => c.Z == 1.0));
    }
}