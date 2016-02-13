using System.IO;
using System.Reflection;
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
            GraphHopperHelper init = new GraphHopperHelper(logger, new ProcessHelper(logger));
            init.Initialize(Path.GetDirectoryName(Assembly.GetAssembly(typeof(GraphHopperInitializerTests)).Location));
        }
    }
}
