using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.DataAccessInterfaces;
using OsmSharp.Tags;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class SimplePointAdderExecutorTests
{
    ISimplePointAdderExecutor _executor;
    IAuthClient _authClient;
    IOverpassTurboGateway _overpassTurboGateway;

    private void SetupHighways(List<Coordinate[]> lines)
    {
        var id = 1;
        var ways = lines.Select(coordinates =>
        {
            var osmCompleteWay = new CompleteWay
            {
                Id = id++,
                Tags = new TagsCollection { { "highway", "something" } },
                Version = 1,
                Nodes = coordinates.Select(coordinate =>
                    new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray()
            };
            _authClient.GetCompleteWay(osmCompleteWay.Id).Returns(osmCompleteWay);
            _authClient.GetWay(osmCompleteWay.Id).Returns(osmCompleteWay.ToSimple() as Way);
            foreach (var node in osmCompleteWay.Nodes)
            {
                _authClient.GetNode(node.Id!.Value).Returns(node);
            }
            return osmCompleteWay;
        }).ToList();

        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(ways);
    }

    [TestInitialize]
    public void TestInitialize()
    {
        _authClient = Substitute.For<IAuthClient>();
        var configurationDate = new ConfigurationData();
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(configurationDate);
        _overpassTurboGateway = Substitute.For<IOverpassTurboGateway>();

        _executor = new SimplePointAdderExecutor(options,
            _overpassTurboGateway, new OsmGeoJsonPreprocessorExecutor(Substitute.For<ILogger>(), new OsmGeoJsonConverter(new GeometryFactory()), new TagsHelper()),
            Substitute.For<ILogger>());
    }

    [TestMethod]
    public void AddInvalidValue_ShouldThrow()
    {
        Assert.ThrowsException<AggregateException>(() => _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(1, 1),
            PointType = SimplePointType.None
        }).Wait());
    }

    [TestMethod]
    public void AddDrinkingWater_ShouldSucceed()
    {
        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(1, 1),
            PointType = SimplePointType.Tap
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Create.Length == 1));
    }

    [TestMethod]
    public void AddPicnicSite_ShouldSucceed()
    {
        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(1, 1),
            PointType = SimplePointType.PicnicSite
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Create.Length == 1));
    }

    [TestMethod]
    public void AddParking_ShouldSucceed()
    {
        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(1, 1),
            PointType = SimplePointType.Parking
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Create.Length == 1));
    }

    [TestMethod]
    public void AddGate_NearNoWhere_ShouldSucceed()
    {
        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(1, 0),
            PointType = SimplePointType.CattleGrid
        });

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Create.Length == 1));

    }

    [TestMethod]
    public void AddGate_NearAnExistingGate_ShouldUpdateExistingGate()
    {
        var id = 1;
        var node = new Node { Id = id, Latitude = 0, Longitude = 0, Tags = new TagsCollection { { "barrier", "gate" } } };
        _authClient.GetNode(node.Id!.Value).Returns(node);

        _overpassTurboGateway.GetClosestBarrierId(Arg.Any<Coordinate>(), Arg.Any<double>()).Returns(1);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 1),
            PointType = SimplePointType.Block
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(),
            Arg.Is<OsmChange>(c => c.Modify.Length == 1 &&
                                   c.Modify.First().Id == id &&
                                   c.Modify.First().Tags.Contains("barrier", "yes") &&
                                   c.Create == null));
    }

    [TestMethod]
    public void AddGate_NearAWayAndVeryCloseToExistingNode_ShouldUpdateExistingNodeAndKeepTags()
    {
        var id = 1;
        var osmCompleteWay = new CompleteWay
        {
            Id = id++,
            Tags = new TagsCollection { { "highway", "something" } },
            Version = 1,
            Nodes = new[] {
                new Coordinate(0,0),
                new Coordinate(1.00001,0),
                new Coordinate(2,0)
            }.Select(coordinate =>
                new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray()
        };
        osmCompleteWay.Nodes[1].Tags = new TagsCollection { { "tourism", "viewpoint" } };
        _authClient.GetCompleteWay(osmCompleteWay.Id).Returns(osmCompleteWay);
        _authClient.GetWay(osmCompleteWay.Id).Returns(osmCompleteWay.ToSimple() as Way);
        foreach (var node in osmCompleteWay.Nodes)
        {
            _authClient.GetNode(node.Id!.Value).Returns(node);
        }

        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([osmCompleteWay]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 1),
            PointType = SimplePointType.Block
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(),
            Arg.Is<OsmChange>(c => c.Modify.Length == 1 &&
                                   c.Modify.First().Tags.Contains("tourism", "viewpoint") &&
                                   c.Create == null));
    }

    [TestMethod]
    public void AddGate_NearAWayAndVeryCloseToExistingNode_ShouldUpdateExistingNodeWithNullTags()
    {
        SetupHighways([[
            new Coordinate(0,0),
            new Coordinate(1.00001,0),
            new Coordinate(2,0)
        ]]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 1),
            PointType = SimplePointType.Block
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Modify.Length == 1 && c.Create == null));
    }

    [TestMethod]
    public void AddGate_ABitAfterTheEndOfTheHighway_ShouldProlongTheHighway()
    {
        SetupHighways([[new Coordinate(0, 0), new Coordinate(1, 0), new Coordinate(2, 0)]]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 2.0001),
            PointType = SimplePointType.ClosedGate
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(),
            Arg.Is<OsmChange>(c => c.Modify.Length == 1 && c.Create.Length == 1 &&
                                   c.Modify.OfType<Way>().First().Nodes.Length == 4 && c.Modify.OfType<Way>().First().Nodes[3] == -1));
    }

    [TestMethod]
    public void AddGate_NearAWay_ShouldAddItInTheRightPlace()
    {
        SetupHighways([[
            new Coordinate(0,0),
            new Coordinate(1.001,0),
            new Coordinate(2,0)
        ]]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 1),
            PointType = SimplePointType.OpenGate
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
            c.Create.Length == 1 && c.Modify.Length == 1 &&
            c.Modify.OfType<Way>().First().Nodes[1] == -1));
    }

    [TestMethod]
    public void AddGate_NearAWay_ShouldAddItOnTheWayItselfPerpendicularToItsLocation()
    {
        SetupHighways([[
            new Coordinate(0,0),
            new Coordinate(1,0),
            new Coordinate(2,0)
        ]]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0.0001, 0.5),
            PointType = SimplePointType.CattleGrid
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
            c.Create.Length == 1 && c.Modify.Length == 1 &&
            c.Modify.OfType<Way>().First().Nodes[1] == -1 &&
            c.Create.OfType<Node>().First().Latitude == 0 &&
            c.Create.OfType<Node>().First().Longitude == 0.5));
    }

    [TestMethod]
    public void AddGate_NearAJunction_ShouldAddItNotOnTheJunctionsNode()
    {
        var id = 1;
        var nodes = new[] {
            new Coordinate(0,0),
            new Coordinate(1,0),
            new Coordinate(2,0),
            new Coordinate(1,1),
            new Coordinate(1,-1)
        }.Select(coordinate =>
            new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray();
        foreach (var node in nodes)
        {
            _authClient.GetNode(node.Id!.Value).Returns(node);
        }
        var osmCompleteWay1 = new CompleteWay
        {
            Id = id++,
            Tags = new TagsCollection { { "highway", "something" } },
            Version = 1,
            Nodes = [nodes[0], nodes[1], nodes[2]]
        };
        _authClient.GetCompleteWay(osmCompleteWay1.Id).Returns(osmCompleteWay1);
        _authClient.GetWay(osmCompleteWay1.Id).Returns(osmCompleteWay1.ToSimple() as Way);

        var osmCompleteWay2 = new CompleteWay
        {
            Id = id++,
            Tags = new TagsCollection { { "highway", "something" } },
            Version = 1,
            Nodes = [nodes[3], nodes[1], nodes[4]]
        };
        _authClient.GetCompleteWay(osmCompleteWay2.Id).Returns(osmCompleteWay2);
        _authClient.GetWay(osmCompleteWay2.Id).Returns(osmCompleteWay2.ToSimple() as Way);
        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([osmCompleteWay1, osmCompleteWay2]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 1.000001),
            PointType = SimplePointType.ClosedGate
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
            c.Create.Length == 1 && c.Modify.Length == 1 &&
            c.Modify.OfType<Way>().First().Nodes[2] == -1));
    }

    [TestMethod]
    public void AddGate_NotNearEnoughToTheEndOfTheWay_ShouldAddANewNodeForIt()
    {
        SetupHighways([[
            new Coordinate(0,0),
            new Coordinate(1,0),
            new Coordinate(2,0)
        ]]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 0.1),
            PointType = SimplePointType.ClosedGate
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
            c.Create.Length == 1 && c.Modify.Length == 1 &&
            c.Modify.OfType<Way>().First().Nodes[1] == -1));
    }

    [TestMethod]
    public void AddGate_GeometryOfTheWayAndGateLocationAreNotCompatible_ShouldThrow()
    {
        SetupHighways([[
            new Coordinate(0,0),
            new Coordinate(1,0),
            new Coordinate(1,-1)
        ]]);

        Assert.ThrowsException<AggregateException>(() => _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0.0001, 1.0001),
            PointType = SimplePointType.ClosedGate
        }).Wait());
    }

    [TestMethod]
    public void AddGate_InsidePolygonAndCloserWay_ShouldAddToCloserWayAndNotConsiderDistanceZeroToPolygon()
    {
        var id = 1;
        var nodes = new[]
        {
            new Coordinate(0, 0),
            new Coordinate(1, 0),
            new Coordinate(1, 1),
            new Coordinate(0, 1),
        }.Select(coordinate =>
            new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray();

        foreach (var node in nodes)
        {
            _authClient.GetNode(node.Id!.Value).Returns(node);
        }

        var osmCompleteWay1 = new CompleteWay
        {
            Id = id++,
            Tags = new TagsCollection { { "highway", "something" } },
            Version = 1,
            Nodes = [nodes[0], nodes[2]]
        };
        _authClient.GetCompleteWay(osmCompleteWay1.Id).Returns(osmCompleteWay1);
        _authClient.GetWay(osmCompleteWay1.Id).Returns(osmCompleteWay1.ToSimple() as Way);

        var osmCompleteWay2 = new CompleteWay
        {
            Id = id++,
            Tags = new TagsCollection { { "highway", "roundabout" } },
            Version = 1,
            Nodes = [nodes[0], nodes[1], nodes[2], nodes[2], nodes[0]]
        };
        _authClient.GetCompleteWay(osmCompleteWay2.Id).Returns(osmCompleteWay2);
        _authClient.GetWay(osmCompleteWay2.Id).Returns(osmCompleteWay2.ToSimple() as Way);
        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([osmCompleteWay1, osmCompleteWay2]);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0.50001, 0.5),
            PointType = SimplePointType.ClosedGate
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
            c.Create.Length == 1 && c.Modify.Length == 1 &&
            c.Modify.OfType<Way>().First().Nodes.Length == 3 &&
            c.Modify.OfType<Way>().First().Nodes[1] == -1));
    }

    [TestMethod]
    public void AddGate_NearAnOutdatedWay_ShouldAddItInTheRightPlace()
    {
        var id = 1;
        var nodes = new[]
        {
            new Coordinate(0,0),
            new Coordinate(0.5, 0),
            new Coordinate(1.001,0),
            new Coordinate(2,0)
        }.Select(coordinate =>
            new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray();

        foreach (var node in nodes)
        {
            _authClient.GetNode(node.Id!.Value).Returns(node);
        }
        var osmCompleteWay = new CompleteWay
        {
            Id = id++,
            Tags = new TagsCollection { { "highway", "something" } },
            Version = 1,
            Nodes = [nodes[0], nodes[2], nodes[3]]
        };
        _overpassTurboGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns([osmCompleteWay]);
        var osmUpdatedWay = new CompleteWay
        {
            Id = osmCompleteWay.Id,
            Tags = osmCompleteWay.Tags,
            Version = 2,
            Nodes = nodes
        };
        _authClient.GetWay(osmUpdatedWay.Id).Returns(osmUpdatedWay.ToSimple() as Way);
        _authClient.GetCompleteWay(osmUpdatedWay.Id).Returns(osmUpdatedWay);

        _executor.Add(_authClient, new AddSimplePointOfInterestRequest
        {
            LatLng = new LatLng(0, 1),
            PointType = SimplePointType.CattleGrid
        }).Wait();

        _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
            c.Create.Length == 1 &&
            c.Modify.Length == 1 &&
            c.Modify.OfType<Way>().First().Nodes[2] == -1
        ));
    }
}