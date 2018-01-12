using System.IO;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class ImgurGatewayTests
    {
        [TestMethod]
        [Ignore]
        public void TestUploadImage()
        {
            var gateway = new ImgurGateway(null, null);
            using (var stream = File.OpenRead(@"C:\Users\harel\Desktop\Mapping\IHM_screenshot_bike.jpg"))
            {
                var result = gateway.UploadImage(stream).Result;
                Assert.IsNotNull(result);
            }       
        }
    }
}
