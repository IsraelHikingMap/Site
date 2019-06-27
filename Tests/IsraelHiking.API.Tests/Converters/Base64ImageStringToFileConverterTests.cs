using IsraelHiking.API.Converters;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;

namespace IsraelHiking.API.Tests.Converters
{
    [TestClass]
    public class Base64ImageStringToFileConverterTests
    {
        [TestMethod]
        public void TestConversion()
        {
            var converter = new Base64ImageStringToFileConverter();
            var data = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                                      "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg==";
            var file = converter.ConvertToFile(data);
            File.WriteAllBytes(@"d:\temp.jpg", file.Content);
        }
    }
}
