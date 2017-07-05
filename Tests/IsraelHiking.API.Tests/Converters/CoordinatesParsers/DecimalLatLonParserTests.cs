using IsraelHiking.API.Converters.CoordinatesParsers;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Converters.CoordinatesParsers
{
    [TestClass]
    public class DecimalLatLonParserTests
    {
        private DecimalLatLonParser _parser;

        [TestInitialize]
        public void TestInitialize()
        {
            _parser = new DecimalLatLonParser();
        }

        [TestMethod]
        public void TryParse_WithComa_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("-11°, +12.2");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11, results.Y);
            Assert.AreEqual(12.2, results.X);
        }

        [TestMethod]
        public void TryParse_WithSpace_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("+11.1  -12.2°");

            Assert.IsNotNull(results);
            Assert.AreEqual(11.1, results.Y);
            Assert.AreEqual(-12.2, results.X);
        }

        [TestMethod]
        public void TryParse_WithSlash_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("-90.000/+180");

            Assert.IsNotNull(results);
            Assert.AreEqual(-90, results.Y);
            Assert.AreEqual(180, results.X);
        }

        [TestMethod]
        public void TryParse_LatitudeOutOfBoundWithComa_ShouldFail()
        {
            var results = _parser.TryParse("+90.0001,-180");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_LatitudeOutOfBoundWithSpace_ShouldFail()
        {
            var results = _parser.TryParse("-90.0001 +180");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_LongitudeOutOfLowerBoundWithSpace_ShouldFail()
        {
            var results = _parser.TryParse("+90 -180.0001");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_LongitudeOutOfUpperBoundWithSpace_ShouldFail()
        {
            var results = _parser.TryParse("-90 +180.0001");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_SingleNumber_ShouldFail()
        {
            var results = _parser.TryParse("+32.2");
            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_TooManyNumbers_ShouldFail()
        {
            var results = _parser.TryParse("+32 2 55 16");
            Assert.IsNull(results);
        }
    }
}
