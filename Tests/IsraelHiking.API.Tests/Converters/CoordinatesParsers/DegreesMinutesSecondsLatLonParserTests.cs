using IsraelHiking.API.Converters.CoordinatesParsers;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Converters.CoordinatesParsers
{
    [TestClass]
    public class DegreesMinutesSecondsLatLonParserTests
    {
        private DegreesMinutesSecondsLatLonParser _parser;

        [TestInitialize]
        public void TestInitialize()
        {
            _parser = new DegreesMinutesSecondsLatLonParser();
        }

        [TestMethod]
        public void TryParse_WithSpace_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11°N 12.2 E");

            Assert.IsNotNull(results);
            Assert.AreEqual(11, results.Y);
            Assert.AreEqual(12.2, results.X);
        }

        [TestMethod]
        public void TryParse_WithSlash_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11°6'S / 12 12 W");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11.1, results.Y);
            Assert.AreEqual(-12.2, results.X);
        }

        [TestMethod]
        public void TryParse_MinutesOutOfRange_ShouldFail()
        {
            var results = _parser.TryParse("11°6'36\"N ,12 61\u2032 0\u2033 W");

            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_SecondsOutOfRange_ShouldFail()
        {
            var results = _parser.TryParse("11°6'36\"N ,12 12\u2032 72\u2033 W");

            Assert.IsNull(results);
        }

        [TestMethod]
        public void TryParse_DegreesMinutesSecondsColon_ShouldPass()
        {
            var results = _parser.TryParse("33:05:23N 35:19:10E");

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void TryParse_DegreesMinutesColon_ShouldPass()
        {
            var results = _parser.TryParse("33:05S 35:19W");

            Assert.IsNotNull(results);
        }
    }
}
