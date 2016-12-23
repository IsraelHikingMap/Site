using System.IO;
using System.Reflection;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class ElevationDataStorageTests
    {
        private IConfigurationProvider _configurationProvider;
        private IElevationDataStorage _elevationDataStorage;

        [TestInitialize]
        public void TestInitialize()
        {
            _configurationProvider = Substitute.For<IConfigurationProvider>();
            _elevationDataStorage = new ElevationDataStorage(new TraceLogger(), _configurationProvider);
        }

        [TestMethod]
        public void InitializeWithBadFolder_ShouldSucceed()
        {
            _configurationProvider.BinariesFolder.Returns("InvalidFolder");

            _elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(0, _elevationDataStorage.GetElevation(new LatLng(32, 35)).Result);
        }

        [TestMethod]
        [Ignore] // This test takes too long...
        public void InitializeAndGet_ShouldSucceed()
        {
            _configurationProvider.BinariesFolder.Returns(Path.GetDirectoryName(Assembly.GetAssembly(typeof(ElevationDataStorageTests)).Location) ?? string.Empty);

            _elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(0, _elevationDataStorage.GetElevation(new LatLng(0,0)));
            Assert.AreEqual(207, _elevationDataStorage.GetElevation(new LatLng(32, 35)));
        }
    }
}
