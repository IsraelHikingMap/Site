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
            var results = _parser.TryParse("11° 6' 36\" S / 012 12 36 W");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11.11, results.Y);
            Assert.AreEqual(-12.21, results.X);
        }

        [TestMethod]
        public void TryParse_WithUnicode1_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11:6\u00b4 36\u02ba S 112° 12\u02b9 54\u201d W");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11.11, results.Y);
            Assert.AreEqual(-112.215, results.X);
        }

        [TestMethod]
        public void TryParse_WithUnicode2_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11° 6\u02bc 36\u2033 S 12° 12\u02ca 54\u275e W");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11.11, results.Y);
            Assert.AreEqual(-12.215, results.X);
        }

        [TestMethod]
        public void TryParse_WithUnicode3_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11° 6\u201d 36\u3003 S 12° 12\u2032 54\u301e W");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11.11, results.Y);
            Assert.AreEqual(-12.215, results.X);
        }

        [TestMethod]
        public void TryParse_WithUnicode4_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11° 6\u275c 36S 12° 12W");

            Assert.IsNotNull(results);
            Assert.AreEqual(-11.11, results.Y);
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
