using IsraelHiking.Common;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using NSubstitute;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class GraphHopperGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void GetRouting_ShouldGetRoutingWithDetails()
        {
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            var gateway = new GraphHopperGateway(factory, options);
            var results = gateway.GetRouting(new RoutingGatewayRequest
            {
                From = new Coordinate(35.24470233230383, 31.971396577420734),
                To = new Coordinate(35.00963707334776, 31.926065209376176),
                Profile = ProfileType.Foot
            }).Result;
            Assert.IsNotNull(results);
            var details = results.Attributes["details"];
            Assert.IsNotNull(details);
        }
    }
}
