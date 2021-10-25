using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using System.Net.Http;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Options;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class ElevationGatewayTests
    {
        private IElevationGateway _elevationGateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            var options = Substitute.For<IOptions<ConfigurationData>>();
            options.Value.Returns(new ConfigurationData());
            _elevationGateway = new ElevationGateway(options, factory);
        }

        [TestMethod]
        [Ignore]
        public void InitializeAndGet_ShouldSucceed()
        {
            Assert.AreEqual(0, _elevationGateway.GetElevation(new Coordinate(0, 0)).Result);
            Assert.AreEqual(207.9998, _elevationGateway.GetElevation(new Coordinate(35, 32)).Result, 1e-2);
            Assert.AreEqual(557.0914, _elevationGateway.GetElevation(new Coordinate(35.3896182, 32.687110)).Result,
                1e-2);
            var values = _elevationGateway.GetElevation(new[]
            {
                new Coordinate(0, 0),
                new Coordinate(35, 32),
                new Coordinate(35.3896182, 32.687110)
            }).Result;
            var expected = new[] {0, 207.9998, 557.0914};
            for (var index = 0; index < values.Length; index++)
            {
                Assert.AreEqual(expected[index], values[index], 1e-2);
            }
        }
    }
}
