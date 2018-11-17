﻿using System.Collections.Generic;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp;
using Microsoft.Extensions.Options;
using OsmSharp.Complete;
using System.Linq;
using OsmSharp.Changesets;

namespace IsraelHiking.API.Tests.Services.Osm
{
    [TestClass]
    public class OsmLineAdderServiceTests
    {
        private IOsmLineAdderService _service;
        private IElasticSearchGateway _elasticSearchGateway;
        private IHttpGatewayFactory _httpGatewayFactory;

        [TestInitialize]
        public void TestInitialize()
        {
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            var geoJsonPreProcessor = Substitute.For<IOsmGeoJsonPreprocessorExecutor>();
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            var options = new ConfigurationData
            {
                MinimalDistanceToClosestPoint = 30,
                MaxDistanceToExisitngLineForMerge = 1
            };
            var optionsProvider = Substitute.For<IOptions<ConfigurationData>>();
            optionsProvider.Value.Returns(options);
            
            _service = new OsmLineAdderService(_elasticSearchGateway, new ItmWgs84MathTransfromFactory(), optionsProvider, geoJsonPreProcessor, _httpGatewayFactory);
        }

        private IOsmGateway SetupOsmGateway(string changesetId)
        {
            var osmGateway = Substitute.For<IOsmGateway>();
            osmGateway.CreateChangeset(Arg.Any<string>()).Returns(changesetId);
            _httpGatewayFactory.CreateOsmGateway(null).Returns(osmGateway);
            return osmGateway;
        }

        private void SetupHighway(int wayId, Coordinate[] coordinates, IOsmGateway osmGateway)
        {
            var osmCompleteWay = new CompleteWay { Id = wayId };
            var id = 1;
            osmCompleteWay.Nodes = coordinates.Select(coordinate => new Node { Id = id++, Latitude = coordinate.Y, Longitude = coordinate.X }).ToArray();
            osmGateway.GetCompleteWay(wayId.ToString()).Returns(osmCompleteWay);
            osmGateway.GetWay(wayId.ToString()).Returns(osmCompleteWay.ToSimple() as Way);
            var table = new AttributesTable
            {
                {FeatureAttributes.ID, wayId.ToString()},
                {FeatureAttributes.OSM_NODES, osmCompleteWay.Nodes.Select(n => n.Id.Value).Cast<object>().ToList()}
            };
            _elasticSearchGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature>
            {
                new Feature(new LineString(coordinates), table)
            });
        }

        [TestMethod]
        public void AddLineWithTags_NoHighwaysInArea_ShouldAddTheLine()
        {
            string changesetId = "1";
            var osmGateway = SetupOsmGateway(changesetId);
            _elasticSearchGateway.GetHighways(Arg.Any<Coordinate>(), Arg.Any<Coordinate>()).Returns(new List<Feature>());
            osmGateway.UploadChangeset(changesetId, Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0]});
            var tags = new Dictionary<string, string>
            {
                {"highway", "track"},
                {"colour", "blue"}
            };

            _service.Add(new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1)}), tags, null).Wait();

            osmGateway.Received(1).CreateChangeset(Arg.Any<string>());
            osmGateway.Received(1).CloseChangeset(changesetId);
            osmGateway.Received(1).UploadChangeset(changesetId, Arg.Is<OsmChange>(x => x.Create.OfType<Node>().Count() == 2 &&
                                                                                       x.Create.OfType<Way>().Count() == 1));
        }

        [TestMethod]
        public void AddLine_OneHighwayNearStart_ShouldAddTheLineAndConnectIt()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[] { new Coordinate(0.0000001, 0), new Coordinate(-1, 0) }, osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[] { new Coordinate(0, 0), new Coordinate(0, 1) }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 2));
        }

        [TestMethod]
        public void AddLine_OneHighwayNearStart_ShouldAddTheLineAndConnectItOnce()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[] { new Coordinate(-1, 0), new Coordinate(0.000007, 0), new Coordinate(1, 0) }, osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[] { new Coordinate(0, -0.000007), new Coordinate(0, 1), new Coordinate(0, 2) }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 3 &&
                                                                                             x.Modify.OfType<Way>().First().Nodes.Length == 4));
        }

        [TestMethod]
        public void AddLine_OneHighwayNearStart_ShouldModifyItOnce()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[] { new Coordinate(-0.1, 0), new Coordinate(1, 0) }, osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[] { new Coordinate(0, 0), new Coordinate(0, 0.00000001), new Coordinate(0, 0.0000002), new Coordinate(0, 1) }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4 &&
                                                                                             x.Modify.OfType<Way>().Count() == 1));
        }

        [TestMethod]
        public void AddLine_OneHighwayNearEnd_ShouldAddTheLineAndConnectIt()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[] { new Coordinate(0, 1.0000001), new Coordinate(0, 2) }, osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[] { new Coordinate(0, 0), new Coordinate(0, 1) }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 2));
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
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[] { new Coordinate(0, 0), new Coordinate(0, -1) }, osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[]
            {
                new Coordinate(-0.1, 0.001),
                new Coordinate(-0.0001, 0),
                new Coordinate(0.1, 0.001)
            }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4));
        }

        /// <summary>
        /// U shape line close to stright line
        ///     \_/
        ///      |
        /// </summary>
        [TestMethod]
        public void AddUShapeDenseLine_OneHighwayNearMiddle_OnlyOneExtraPoint()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[] { new Coordinate(0, 0), new Coordinate(0, -1) }, osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[]
            {
                new Coordinate(-0.1, 0.01),
                new Coordinate(-0.0001, 0),
                new Coordinate(0.0001, 0),
                new Coordinate(0.1, 0.01)
            }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 5));
        }

        /// <summary>
        /// \_/\_/
        ///  |__|
        /// </summary>
        [TestMethod]
        public void AddWShapeDenseLine_HighwayUShape_TwoExtraPoints()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[]
                {
                    new Coordinate(0, 0),
                    new Coordinate(0, -1),
                    new Coordinate(1, -1),
                    new Coordinate(1, 0),
                },
                osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[]
            {
                new Coordinate(-1, 1),
                new Coordinate(-0.0001, 0),
                new Coordinate(0.0001, 0),
                new Coordinate(0.5, 1),
                new Coordinate(0.9999, 0),
                new Coordinate(1.0001, 0),
                new Coordinate(1.0001, 1),
            }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 9));
        }

        /// <summary>
        ///  _|_
        /// </summary>
        [TestMethod]
        public void AddStraightLine_HighwaySparseOrthogonalStrightLine_ShouldUpdateExitingWay()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[]
                {
                    new Coordinate(0, 0),
                    new Coordinate(1, 0),
                },
                osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[]
            {
                new Coordinate(0.5, 1),
                new Coordinate(0.5, 0),
            }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 2 &&
                                                                                             x.Create.OfType<Node>().Count() == 2 &&
                                                                                             x.Modify.OfType<Way>().Count() == 1));
        }

        [TestMethod]
        public void TriangleBug_OneHighway_OneConnectingLines()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[]
                {
                    new Coordinate(34.83509, 30.87568),
                    new Coordinate(34.83503, 30.87574),
                    new Coordinate(34.83481, 30.87598)
                },
                osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[]
            {
                new Coordinate(34.9354262, 30.8753466),
                new Coordinate(34.8352167, 30.8754542),
                new Coordinate(34.8353618,30.8757884),
                new Coordinate(34.7352248,30.8760586)
            }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4));
        }

        /// <summary>
        /// ______
        /// _____/
        ///   | 
        /// </summary>
        [TestMethod]
        public void AddAwayAndBackLine_NearAnotherLine_ShouldNotCreateASelfIntersectingLine()
        {
            var osmGateway = SetupOsmGateway("42");
            SetupHighway(42, new[]
                {
                    new Coordinate(0, 0),
                    new Coordinate(0, -1),
                },
                osmGateway);
            osmGateway.UploadChangeset(Arg.Any<string>(), Arg.Any<OsmChange>()).Returns(new DiffResult { Results = new OsmGeoResult[0] });

            _service.Add(new LineString(new[]
            {
                new Coordinate(-1, 0),
                new Coordinate(1, 0),
                new Coordinate(-1, 0.00001),
            }), new Dictionary<string, string>(), null).Wait();

            osmGateway.Received(1).UploadChangeset(Arg.Any<string>(), Arg.Is<OsmChange>(x => x.Create.OfType<Way>().First().Nodes.Length == 4 &&
                                                                                             x.Create.OfType<Node>().Count() == 3));
        }
    }
}
