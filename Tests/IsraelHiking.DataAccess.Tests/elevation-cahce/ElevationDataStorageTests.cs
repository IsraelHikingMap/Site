using GeoAPI.Geometries;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Geometries;
using System.IO;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class ElevationDataStorageTests
    {
        private IElevationDataStorage _elevationDataStorage;

        [TestInitialize]
        public void TestInitialize()
        {
            _elevationDataStorage = new ElevationDataStorage(new TraceLogger(), new PhysicalFileProvider(Directory.GetCurrentDirectory()));
        }

        [TestMethod]
        public void InitializeAndGet_ShouldSucceed()
        {
            _elevationDataStorage.Initialize().Wait();

            Assert.AreEqual(null, _elevationDataStorage.Initialize().Exception);
            Assert.AreEqual(0, _elevationDataStorage.GetElevation(new Coordinate(0,0)).Result);
            Assert.AreEqual(207, _elevationDataStorage.GetElevation(new Coordinate(35, 32)).Result);
            Assert.AreEqual(554.15067, _elevationDataStorage.GetElevation(new Coordinate(35.3896182, 32.687110)).Result, 1e-7);
        }
    }
}
