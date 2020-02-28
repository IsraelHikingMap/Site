using IsraelHiking.Common;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System;

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
            nonPublic.DropboxApiToken = "some-access-token";
            var options = Substitute.For<IOptions<NonPublicConfigurationData>>();
            options.Value.Returns(nonPublic);
            _gateway = new DropboxGateway(Substitute.For<ILogger>(), options);
            _gateway.Initialize();
        }

        [TestMethod]
        [Ignore]
        public void GetFilesList()
        {
            Assert.IsTrue(_gateway.GetUpdatedFilesList(DateTime.UnixEpoch).Result.Count > 0);
        }

        [TestMethod]
        [Ignore]
        public void GetFile()
        {
            Assert.IsNotNull(_gateway.GetFileContent("glyphs.ihm").Result);

        }
    }
}
