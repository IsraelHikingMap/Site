using IsraelHiking.API.Converters.CoordinatesParsers;
using IsraelHiking.API.Executors;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Converters.CoordinatesParsers
{
    [TestClass]
    public class UtmParserTests
    {
        private UtmParser _parser;

        [TestInitialize]
        public void TestInitialize()
        {
            _parser = new UtmParser(ItmWgs84MathTransfromFactory.Create());
        }

        [TestMethod]
        public void TryParse_ItmWithSpace_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("200000 600000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_ItmWithComa_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("200000,600000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_ItmWithSlash_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("200000/600000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_IcsWithSpace_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("120000 900000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_IcsWithComa_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("120000,200000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_IcsWithSpaceNearUpperBounds_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("120000 1349999");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_OnEastingLowerBoundry_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("100000 600000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_OnEastingUpperBoundry_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("300000 600000");
            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_IcsWithoutSpace_ShouldFail()
        {
            var results = _parser.TryParse("1200001100000");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_ItmWithoutSpace_ShouldFail()
        {
            var results = _parser.TryParse("200000600000");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_ItmOutOfBoundries_ShouldFail()
        {
            var results = _parser.TryParse("300001,600000");
            Assert.IsNull(results);

            results = _parser.TryParse("99999,600000");
            Assert.IsNull(results);

            results = _parser.TryParse("300001,100000");
            Assert.IsNull(results);

            results = _parser.TryParse("200000,1350000");
            Assert.IsNull(results);
        }
    }
}
