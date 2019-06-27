using IsraelHiking.API.Converters;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;

namespace IsraelHiking.API.Tests.Converters
{
    [TestClass]
    public class Base64ImageStringToFileConverterTests
    {
        private Base64ImageStringToFileConverter _converter;

        [TestInitialize]
        public void TestInitialize()
        {
            _converter = new Base64ImageStringToFileConverter();
        }

        [TestMethod]
        public void TestConversionInValidBase64String_ShouldReturnNull()
        {
            var file = _converter.ConvertToFile("invalid string");
            Assert.IsNull(file);
        }

        [TestMethod]
        public void TestConversionValidBase64String_ShouldConvert()
        {
            var converter = new Base64ImageStringToFileConverter();
            var data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";
            var file = converter.ConvertToFile(data);
            Assert.IsNotNull(file.Content);
        }
    }
}
