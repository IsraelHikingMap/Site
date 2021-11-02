using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using OsmSharp.Changesets;
using OsmSharp.Complete;
using OsmSharp.IO.API;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Tests.Executors
{
    [TestClass]
    public class SimplePointAdderExecutorTests
    {
        ISimplePointAdderExecutor _executor;
        IAuthClient _authClient;
        IHighwaysRepository _highwaysRepository;
        IOsmGeoJsonPreprocessorExecutor _osmGeoJsonPreprocessorExecutor;

        [TestInitialize]
        public void TestInitialize()
        {
            _authClient = Substitute.For<IAuthClient>();
            var configurationDate = new ConfigurationData();
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(configurationDate);
            _highwaysRepository = Substitute.For<IHighwaysRepository>();
            _osmGeoJsonPreprocessorExecutor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _executor = new SimplePointAdderExecutor(options, _highwaysRepository, _osmGeoJsonPreprocessorExecutor);
        }

        [TestMethod]
        public void AddDringkingWater_ShouldSucceed()
        {
            _executor.Add(_authClient, new AddSimplePointOfInterestRequest
            {
                LatLng = new LatLng(1, 1),
                PointType = SimplePointType.Tap
            }).Wait();

            _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Create.Length == 1));
        }

        [TestMethod]
        public void AddGate_NearNoWhere_ShouldSucceed()
        {
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature>());
            
            _executor.Add(_authClient, new AddSimplePointOfInterestRequest
            {
                LatLng = new LatLng(1, 0),
                PointType = SimplePointType.CattleGrid
            });
            
            _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Create.Length == 1));

        }

        [TestMethod]
        public void AddGate_NearAWayAndVeryCloseToExistingNode_ShouldUpdateExsitingNode()
        {
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1.00001,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_42"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(42).Returns(new Way { Id = 42, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });
            _executor.Add(_authClient, new AddSimplePointOfInterestRequest
            {
                LatLng = new LatLng(0, 1),
                PointType = SimplePointType.CattleGrid
            }).Wait();

            _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c => c.Modify.Length == 1 && c.Create == null));
        }

        [TestMethod]
        public void AddGate_ABitAfterTheEndOfTheHighway_ShouldProlongTheHighway()
        {
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_42"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(42).Returns(new Way { Id = 42, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });
            _executor.Add(_authClient, new AddSimplePointOfInterestRequest
            {
                LatLng = new LatLng(0, 2.0001),
                PointType = SimplePointType.CattleGrid
            }).Wait();

            _authClient.Received().UploadChangeset(Arg.Any<long>(),
                Arg.Is<OsmChange>(c => c.Modify.Length == 1 && c.Create.Length == 1 &&
                c.Modify.OfType<Way>().First().Nodes.Length == 4 && c.Modify.OfType<Way>().First().Nodes[3] == -1));
        }

        [TestMethod]
        public void AddGate_NearAWay_ShouldAddItInTheRightPlace()
        {
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1.001,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_42"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(42).Returns(new Way { Id = 42, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });
            _executor.Add(_authClient, new AddSimplePointOfInterestRequest
            {
                LatLng = new LatLng(0, 1),
                PointType = SimplePointType.CattleGrid
            }).Wait();

            _authClient.Received().UploadChangeset(Arg.Any<long>(), Arg.Is<OsmChange>(c =>
                c.Create.Length == 1 && c.Modify.Length == 1 &&
                c.Modify.OfType<Way>().First().Nodes[1] == -1));
        }

        [TestMethod]
        public void AddGate_NearAWay_ShouldAddItOnTheWayItselfPerpendicularToItsLocation()
        {
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_42"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(42).Returns(new Way { Id = 42, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });
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
        public void AddGate_NearAJunction_ShouldAddItNotOnTheJuctionsNode()
        {
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_1"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            var feature2 = new Feature(new LineString(new[] {
                    new Coordinate(1,1),
                    new Coordinate(1,0),
                    new Coordinate(1,-1)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 3, 1, 4} },
                    {FeatureAttributes.ID, "Way_2"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(1).Returns(new Way { Id = 1, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _authClient.GetWay(2).Returns(new Way { Id = 2, Version = 1, Nodes = new long[] { 3, 1, 4 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature, feature2 });

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
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_1"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(1).Returns(new Way { Id = 1, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });

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
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,0),
                    new Coordinate(1,-1)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_1"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(1).Returns(new Way { Id = 1, Version = 1, Nodes = new long[] { 0, 1, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });

            Assert.ThrowsException<AggregateException>(() => _executor.Add(_authClient, new AddSimplePointOfInterestRequest
            {
                LatLng = new LatLng(0.0001, 1.0001),
                PointType = SimplePointType.ClosedGate
            }).Wait());
        }

        [TestMethod]
        public void AddGate_InsidePolygonAndCloserWay_ShouldAddToCloserWay()
        {
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,1)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1 } },
                    {FeatureAttributes.ID, "Way_1"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            var feature2 = new Feature(new Polygon(new LinearRing(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1,0),
                    new Coordinate(1,1),
                    new Coordinate(0,1),
                    new Coordinate(0,0)
                })), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 2, 3, 4, 5, 2} },
                    {FeatureAttributes.ID, "Way_2"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(1).Returns(new Way { Id = 1, Version = 1, Nodes = new long[] { 0, 1 } });
            _authClient.GetWay(2).Returns(new Way { Id = 2, Version = 1, Nodes = new long[] { 2, 3, 4, 5, 2 } });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature, feature2 });

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
            var feature = new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(1.001,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 1, 2} },
                    {FeatureAttributes.ID, "Way_42"},
                    {FeatureAttributes.POI_VERSION, 1 }
                });
            foreach (var coordinate in feature.Geometry.Coordinates)
            {
                _authClient.GetNode(feature.Geometry.Coordinates.ToList().IndexOf(coordinate))
                    .Returns(new Node() { Longitude = coordinate.X, Latitude = coordinate.Y });
            }
            _authClient.GetWay(42).Returns(new Way { Id = 42, Version = 2, Nodes = new long[] { 0, 1, 2, 3 } });
            _authClient.GetCompleteWay(42).Returns(new CompleteWay());
            _osmGeoJsonPreprocessorExecutor.Preprocess(Arg.Any<List<CompleteWay>>()).Returns(new List<Feature> {
                new Feature(new LineString(new[] {
                    new Coordinate(0,0),
                    new Coordinate(0.5,0),
                    new Coordinate(1.001,0),
                    new Coordinate(2,0)
                }), new AttributesTable {
                    {FeatureAttributes.POI_OSM_NODES, new List<object> { 0, 7, 1, 2} },
                    {FeatureAttributes.ID, "Way_42"},
                    {FeatureAttributes.POI_VERSION, 2 }
                })
            });
            _highwaysRepository.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature> { feature });

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
}
