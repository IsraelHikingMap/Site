using System.IO;
using System.Reflection;
using GeoAPI.Geometries;
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
            _elevationDataStorage = new ElevationDataStorage(new TraceLogger(), _configurationProvider, new FileSystemHelper());
        }

        [TestMethod]
        public void InitializeWithBadFolder_ShouldSucceed()
        {
            _configurationProvider.BinariesFolder.Returns("InvalidFolder");

            _elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(0, _elevationDataStorage.GetElevation(new Coordinate(35, 32)).Result);
        }

        [TestMethod]
        public void InitializeAndGet_ShouldSucceed()
        {
            _configurationProvider.BinariesFolder.Returns(Path.GetDirectoryName(Assembly.GetAssembly(typeof(ElevationDataStorageTests)).Location) ?? string.Empty);

            _elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(0, _elevationDataStorage.GetElevation(new Coordinate(0,0)).Result);
            Assert.AreEqual(207, _elevationDataStorage.GetElevation(new Coordinate(35, 32)).Result);
            Assert.AreEqual(554.15067, _elevationDataStorage.GetElevation(new Coordinate(35.3896182, 32.687110)).Result, 1e-7);
        }
    }
}
