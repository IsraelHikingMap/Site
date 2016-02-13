using IsraelHiking.DataAccess.GraphHopper;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class GraphHopperInitializerTests
    {
        [TestMethod]
        [Ignore]
        public void Initialize_ShouldAddService()
        {
            var logger = new TraceLogger();
            GraphHopperInitializer init = new GraphHopperInitializer(logger, new ProcessHelper(logger));
            init.InstallServiceIfNeeded();
        }
    }
}
