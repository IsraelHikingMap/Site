using Microsoft.Extensions.FileProviders;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.IO;
using System.Net.Http;

namespace IsraelHiking.DataAccess.Tests.GraphHopper
{
    [TestClass]
    public class GraphHopperHelperTests
    {
        [TestMethod]
        [Ignore]
        public void Initialize_ShouldAddService()
        {
            var logger = new TraceLogger();
            var physical = new PhysicalFileProvider(@"D:\Github\IsraelHikingMap\Site\IsraelHiking.Web\bin\Debug\netcoreapp1.1");
            var factory = Substitute.For<IHttpClientFactory>();
            factory.CreateClient().Returns(new HttpClient());
            var gateway = new GraphHopperGateway(factory, logger);
            var memoryStream = new MemoryStream();
            physical.GetFileInfo("israel-and-palestine-latest.osm.pbf").CreateReadStream().CopyTo(memoryStream);
            gateway.Rebuild(memoryStream).Wait();
        }
    }
}
