using IsraelHiking.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.Text;

namespace IsraelHiking.DataAccess.Tests
{
    [TestClass]
    public class DropboxGatewayTests
    {
        private DropboxGateway _gateway;

        [TestInitialize]
        public void TestInitialize()
        {
            var nonPublic = new NonPublicConfigurationData();
            // HM TODO: remove this!!
            nonPublic.DropboxApiToken = "5uK8xFbtxoAAAAAAAAAAELWSYAjVOqEhuVxfo7M5Hpa3NZuRlXxfKRk1iz13uYbm";
            var options = Substitute.For<IOptions<NonPublicConfigurationData>>();
            options.Value.Returns(nonPublic);
            _gateway = new DropboxGateway(Substitute.For<ILogger>(), options);
            _gateway.Initialize();
        }

        [TestMethod]
        public void GetFilesList()
        {
            Assert.IsTrue(_gateway.GetUpdatedFilesList(DateTime.UnixEpoch).Result.Count > 0);
        }

        [TestMethod]
        public void GetFile()
        {
            Assert.IsNotNull(_gateway.GetFileContent("glyphs.ihm").Result);

        }
    }
}
