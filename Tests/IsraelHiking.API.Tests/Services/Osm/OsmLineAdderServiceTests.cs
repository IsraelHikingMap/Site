using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using OsmSharp.Tags;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.API.Tests.Services.Osm;

[TestClass]
public class OsmLineAdderServiceTests
{
    private IOsmLineAdderService _service;
    private IOverpassTurboGateway _overpassTurboGateway;
    private IClientsFactory _clientsFactory;

    [TestInitialize]
    public void TestInitialize()
    {
        _overpassTurboGateway = Substitute.For<IOverpassTurboGateway>();
        _clientsFactory = Substitute.For<IClientsFactory>();
        var options = new ConfigurationData
        {
            MinimalDistanceToClosestPoint = 30,
            MaxDistanceToExistingLineForMerge = 1
        };
        var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
        optionsProvider.Value.Returns(options);
        var geoJsonPreProcessor = new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(), Substitute.For<IElevationGateway>(), new OsmGeoJsonConverter(new GeometryFactory()), new TagsHelper(optionsProvider));
        _service = new OsmLineAdderService(_overpassTurboGateway, new ItmWgs84MathTransformFactory(), optionsProvider, geoJsonPreProcessor, new GeometryFactory());
    }

    private IAuthClient SetupOsmGateway(long changesetId)
    {
        var osmGateway = Substitute.For<IAuthClient>();
        osmGateway.CreateChangeset(Arg.Any<TagsCollection>()).Returns(changesetId);
        _clientsFactory.CreateOAuth2Client(Arg.Any<string>()).Returns(osmGateway);
        return osmGateway;
    }

    private void SetupHighway(int wayId, Coordinate[] coordinates, IAuthClient osmGateway)
    {
        var osmCompleteWay = new CompleteWay { Id = wayId, Tags = new TagsCollection{{"highway", "something"}}};
        var id = 1;
        osmCompleteWay.Nodes = coordinates.Select(coordinate => new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray();
        osmGateway.GetCompleteWay(wayId).Returns(osmCompleteWay);
        osmGateway.GetWay(wayId).Returns(osmCompleteWay.ToSimple() as Way);
        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([osmCompleteWay]);
    }

    [TestMethod]
    public void AddLineWithTags_NoHighwaysInArea_ShouldAddTheLine()
    {
        long changesetId = 1;
        var osmGateway = SetupOsmGateway(changesetId);
        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([]);
        osmGateway.UploadChangeset(changesetId, Arg.Any<OsmChange>()).Returns(new DiffResult { Results = []});
        var tags = new Dictionary<string, string>
        {
            {"highway", "track"},
            {"colour", "blue"}
        };

        _service.Add(new LineString([new Coordinate(0, 0), new Coordinate(1, 1)]), tags, osmGateway).Wait();

        osmGateway.Received(1).CreateChangeset(Arg.Any<TagsCollection>());
        osmGateway.Received(1).CloseChangeset(changesetId);
        osmGateway.Received(1).UploadChangeset(changesetId, Arg.Is<OsmChange>(x => x.Create.OfType<Node>().Count() == 2 &&
            x.Create.OfType<Way>().Count() == 1));
    }

    [TestMethod]
    public void AddLine_OneHighwayNearStart_ShouldAddTheLineAndConnectIt()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [new Coordinate(0.0000001, 0), new Coordinate(-1, 0)], osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([new Coordinate(0, 0), new Coordinate(0, 1)]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 2));
    }

    [TestMethod]
    public void AddLine_OneHighwayNearStart_ShouldAddTheLineAndConnectItOnce()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [new Coordinate(-1, 0), new Coordinate(0.000007, 0), new Coordinate(1, 0)], osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([new Coordinate(0, -0.000007), new Coordinate(0, 1), new Coordinate(0, 2)]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 3 &&
            x.Modify.OfType<Way>().First().Nodes.Length == 4));
    }

    [TestMethod]
    public void AddLine_OneHighwayNearStart_ShouldModifyItOnce()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [new Coordinate(-0.1, 0), new Coordinate(1, 0)], osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([new Coordinate(0, 0), new Coordinate(0, 0.00000001), new Coordinate(0, 0.0000002), new Coordinate(0, 1)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4 &&
            x.Modify.OfType<Way>().Count() == 1));
    }

    [TestMethod]
    public void AddLine_OneHighwayNearEnd_ShouldAddTheLineAndConnectIt()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [new Coordinate(0, 1.0000001), new Coordinate(0, 2)], osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([new Coordinate(0, 0), new Coordinate(0, 1)]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 2));
    }

    /// <summary>
    /// V shape line close to stright line
    ///     \ /
    ///      V
    ///      |
    /// </summary>
    [TestMethod]
    public void AddVShapeLine_OneHighwayNearMiddle_ShouldAddTheLineWithAnotherLine()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [new Coordinate(0, 0), new Coordinate(0, -1)], osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(-0.1, 0.001),
            new Coordinate(-0.0001, 0),
            new Coordinate(0.1, 0.001)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4));
    }

    /// <summary>
    /// U shape line close to stright line
    ///     \_/
    ///      |
    /// </summary>
    [TestMethod]
    public void AddUShapeDenseLine_OneHighwayNearMiddle_OnlyOneExtraPoint()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [new Coordinate(0, 0), new Coordinate(0, -1)], osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(-0.1, 0.01),
            new Coordinate(-0.0001, 0),
            new Coordinate(0.0001, 0),
            new Coordinate(0.1, 0.01)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 5));
    }

    /// <summary>
    /// \_/\_/
    ///  |__|
    /// </summary>
    [TestMethod]
    public void AddWShapeDenseLine_HighwayUShape_TwoExtraPoints()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [
                new Coordinate(0, 0),
                new Coordinate(0, -1),
                new Coordinate(1, -1),
                new Coordinate(1, 0)
            ],
            osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(-1, 1),
            new Coordinate(-0.0001, 0),
            new Coordinate(0.0001, 0),
            new Coordinate(0.5, 1),
            new Coordinate(0.9999, 0),
            new Coordinate(1.0001, 0),
            new Coordinate(1.0001, 1)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 9));
    }

    /// <summary>
    ///  _|_
    /// </summary>
    [TestMethod]
    public void AddStraightLine_HighwaySparseOrthogonalStrightLine_ShouldUpdateExitingWay()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [
                new Coordinate(0, 0),
                new Coordinate(1, 0)
            ],
            osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(0.5, 1),
            new Coordinate(0.5, 0)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 2 &&
            x.Create.OfType<Node>().Count() == 2 &&
            x.Modify.OfType<Way>().Count() == 1));
    }

    [TestMethod]
    public void TriangleBug_OneHighway_OneConnectingLines()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [
                new Coordinate(34.83509, 30.87568),
                new Coordinate(34.83503, 30.87574),
                new Coordinate(34.83481, 30.87598)
            ],
            osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(34.9354262, 30.8753466),
            new Coordinate(34.8352167, 30.8754542),
            new Coordinate(34.8353618,30.8757884),
            new Coordinate(34.7352248,30.8760586)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4));
    }

    /// <summary>
    /// ______
    /// _____/
    ///   | 
    /// </summary>
    [TestMethod]
    public void AddAWayAndBackLine_NearAnotherLine_ShouldNotCreateASelfIntersectingLine()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [
                new Coordinate(0, 0),
                new Coordinate(0, -1)
            ],
            osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(-1, 0),
            new Coordinate(1, 0),
            new Coordinate(-1, 0.00001)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4 &&
            x.Create.OfType<Node>().Count() == 3));
    }

    /// <summary>
    ///        _
    ///       / |
    /// <___./__|
    /// </summary>
    [TestMethod]
    public void AddAWay_LoopToItself_ShouldUseTheStartNodeIdInTheMiddleToo()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [
                new Coordinate(0, 0),
                new Coordinate(0, -1)
            ],
            osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(1.5, 0),
            new Coordinate(1, 1),
            new Coordinate(2, 1),
            new Coordinate(2, 0),
            new Coordinate(1, 0),
            new Coordinate(0, 0)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 7 &&
            x.Create.OfType<Node>().Count() == 5 &&
            x.Create.OfType<Way>().First().Nodes[4] == -1));
    }

    /// <summary>
    ///        _
    ///      _/ |
    /// <___|___|
    /// </summary>
    [TestMethod]
    public void AddAWay_LoopToItselfBeforeLastSectionIsCloseEnoughToo_ShouldNotAddTheFirstNodeInTheWrongPlace()
    {
        var osmGateway = SetupOsmGateway(42);
        SetupHighway(42, [
                new Coordinate(0, 0),
                new Coordinate(0, -1)
            ],
            osmGateway);
        osmGateway.UploadChangeset(Arg.Any<long>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = [] });

        _service.Add(new LineString([
            new Coordinate(1.5, 0),
            new Coordinate(1, 1),
            new Coordinate(2, 1),
            new Coordinate(2, 0),
            new Coordinate(1.500001, 0),
            new Coordinate(0, 0)
        ]), new Dictionary<string, string>(), osmGateway).Wait();

        osmGateway.Received(1).UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 7 &&
            x.Create.OfType<Node>().Count() == 5 &&
            x.Create.OfType<Way>().First().Nodes[5] == -1));
    }
}