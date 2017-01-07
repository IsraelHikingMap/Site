using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using IsraelTransverseMercator;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;
using OsmSharp.Osm;

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
            var geoJsonPreProcessor = Substitute.For<IOsmGeoJsonPreprocessor>();
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _service = new OsmLineAdderService(_elasticSearchGateway, new CoordinatesConverter(), Substitute.For<IConfigurationProvider>(), geoJsonPreProcessor, _httpGatewayFactory);
        }

        [TestMethod]
        public void AddLine_NoHighwaysInArea_ShouldAddTheLine()
        {
            var tokenAndSecret = new TokenAndSecret(string.Empty, string.Empty);
            var osmGateway = Substitute.For<IOsmGateway>();
            var changesetId = "1";
            var random = new Random(0);
            osmGateway.CreateChangeset(Arg.Any<string>()).Returns(changesetId);
            osmGateway.CreateNode(changesetId, Arg.Any<Node>()).Returns((x) => Task.FromResult(random.Next(100).ToString()));
            _httpGatewayFactory.CreateOsmGateway(tokenAndSecret).Returns(osmGateway);
            _elasticSearchGateway.GetHighways(Arg.Any<LatLng>(), Arg.Any<LatLng>()).Returns(new List<Feature>());

            _service.Add(new LineString(new[] {new Coordinate(0, 0), new Coordinate(1, 1)}),
                new Dictionary<string, string>(), tokenAndSecret).Wait();

            osmGateway.Received(1).CreateChangeset(Arg.Any<string>());
            osmGateway.Received(1).CloseChangeset(changesetId);
            osmGateway.Received(2).CreateNode(changesetId, Arg.Any<Node>());
            osmGateway.Received(1).CreateWay(changesetId, Arg.Any<Way>());
        }
    }
}
