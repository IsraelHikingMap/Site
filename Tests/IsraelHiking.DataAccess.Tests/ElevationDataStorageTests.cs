using System;
using System.Configuration;
using System.IO;
using System.Reflection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class ElevationDataStorageTests
    {
        [TestMethod]
        public void InitializeWithBadFolder_ShouldSucceed()
        {
            var elevationDataStorage = new ElevationDataStorage(new TraceLogger());
            ConfigurationManager.AppSettings[ProcessHelper.BIN_FOLDER_KEY] = "InvalidFolder";

            elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(0, elevationDataStorage.GetElevation(32, 35).Result);
        }

        [TestMethod]
        [Ignore] // This test takes too long...
        public void InitializeAndGet_ShouldSucceed()
        {
            var elevationDataStorage = new ElevationDataStorage(new TraceLogger());
            ConfigurationManager.AppSettings[ProcessHelper.BIN_FOLDER_KEY] = Path.GetDirectoryName(Assembly.GetAssembly(typeof(ElevationDataStorageTests)).Location) ?? string.Empty;

            elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(0, elevationDataStorage.GetElevation(0,0));
            Assert.AreEqual(207, elevationDataStorage.GetElevation(32, 35));
        }
    }
}
