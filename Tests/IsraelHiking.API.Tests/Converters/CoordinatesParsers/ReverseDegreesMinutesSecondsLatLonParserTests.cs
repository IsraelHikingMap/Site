using IsraelHiking.API.Converters.CoordinatesParsers;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Converters.CoordinatesParsers
{
    [TestClass]
    public class ReverseDegreesMinutesSecondsLatLonParserTests
    {
        private ReverseDegreesMinutesSecondsLatLonParser _parser;

        [TestInitialize]
        public void TestInitialize()
        {
            _parser = new ReverseDegreesMinutesSecondsLatLonParser();
        }

        [TestMethod]
        public void TryParse_ShouldReturnCoordinates()
        {
            var results = _parser.TryParse("11°6'36\"W ,12 12\u2032 54\u2033 N");

            Assert.IsNotNull(results);
            Assert.AreEqual(12.215, results.Y);
            Assert.AreEqual(-11.11, results.X);
        }

        [TestMethod]
        public void TryParse_SecondOutOfRnage_ShouldFail()
        {
            var results = _parser.TryParse("11°6'36\"W ,12 12\u2032 72\u2033 N");

            Assert.IsNull(results);
        }
    }
}
