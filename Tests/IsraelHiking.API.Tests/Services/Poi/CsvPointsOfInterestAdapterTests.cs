using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;
using System.Text;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class CsvPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private CsvPointsOfInterestAdapter _adapter;
        
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;

        private void SetupFileStream(string address)
        {
            var bytes = Encoding.UTF8.GetBytes(
                "Id,Title,Description,Website,ImageUrl,SourceImageUrl,Category,FileUrl,Icon,IconColor,Latitude,Longitude\r\n1,2,3,4,5,6,7,8,9,0,1,2");
            _remoteFileFetcherGateway.GetFileContent(address).Returns(new RemoteFileFetcherGatewayResponse
            {
                Content = bytes,
                FileName = ""
            });
        }

        [TestInitialize]
        public void TestInitialize()
        {
            InitializeSubstitues();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            _adapter = new CsvPointsOfInterestAdapter(_dataContainerConverterService, _remoteFileFetcherGateway, Substitute.For<ILogger>());
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldReturnOnePoint()
        {
            var address = "http://csv.csv";
            _adapter.SetFileNameAndAddress("csv.csv", address);
            SetupFileStream(address);

            var features = _adapter.GetPointsForIndexing().Result;

            Assert.AreEqual(1, features.Count);
        }

        [TestMethod]
        public void GetById_IndexingRan_ShouldReturnOnePoint()
        {
            var address = "http://csv.csv";
            _adapter.SetFileNameAndAddress("csv.csv", address);
            SetupFileStream(address);
            _adapter.GetPointsForIndexing().Wait();

            var feature = _adapter.GetRawPointOfInterestById("1");

            Assert.IsNotNull(feature);
        }
    }
}
