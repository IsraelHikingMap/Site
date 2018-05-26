using IsraelHiking.API.Converters.CoordinatesParsers;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Converters.CoordinatesParsers
{
    [TestClass]
    public class SixNumbersCoordinatesParserTests
    {
        private SixNumbersCoordinatesParser _parser;

        [TestInitialize]
        public void TestInitialize()
        {
            _parser = new SixNumbersCoordinatesParser();
        }

        [TestMethod]
        public void MatchSixNumbersWithCharacters_ShouldMatch()
        {
            var coordinatesString = "  32°   33'34\"   35°36:37   ";

            var results = _parser.TryParse(coordinatesString);

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void MatchSixNumbersWithSpecialCharacters_ShouldMatch()
        {
            var coordinatesString = "32   33\u00b4 34.1   35° 36: 37.2";

            var results = _parser.TryParse(coordinatesString);

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void MatchSixNumbers_ShouldMatch()
        {
            var coordinatesString = "32 33 34 35 36 37";

            var results = _parser.TryParse(coordinatesString);

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void MatchSixNumbers_WithSigns_ShouldMatch()
        {
            var coordinatesString = "-32 33 34 +35 36 37";

            var results = _parser.TryParse(coordinatesString);

            Assert.IsNotNull(results);
        }

        [TestMethod]
        public void MatchSixNumbers_HasOnlyFive_ShouldNotMatch()
        {
            var coordinatesString = "32 33 34 35 36";

            var results = _parser.TryParse(coordinatesString);

            Assert.IsNull(results);
        }

        [TestMethod]
        public void MatchSixNumbers_DecimalNumbersNotInTheRightPlace_ShouldNotMatch()
        {
            var coordinatesString = "32 33.2 34 35 36.3 37";

            var results = _parser.TryParse(coordinatesString);

            Assert.IsNull(results);
        }
    }
}
