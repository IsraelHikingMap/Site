using IsraelHiking.DataAccess.GraphHopper;
using Microsoft.Extensions.FileProviders;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using System.IO;

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
            var gateway = new GraphHopperGateway(logger, physical);
            var memoryStream = new MemoryStream();
            physical.GetFileInfo("israel-and-palestine-latest.osm.pbf").CreateReadStream().CopyTo(memoryStream);
            gateway.Rebuild(memoryStream, "israel-and-palestine-latest.osm.pbf").Wait();
        }
    }
}
