using IsraelHiking.API.Converters.ConverterFlows;
using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace IsraelHiking.API.Tests.Services.Poi
{
    [TestClass]
    public class CsvPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
    {
        private CsvPointsOfInterestAdapter _adapter;
        
        private IFileProvider _fileProvider;
        private IRemoteFileFetcherGateway _remoteFileFetcherGateway;

        private void SetupFileStream()
        {
            var file = Substitute.For<IFileInfo>();
            file.CreateReadStream().Returns(new MemoryStream(Encoding.UTF8.GetBytes(
                "Id,Title,Description,Website,ImageUrl,SourceImageUrl,Category,FileUrl,Icon,IconColor,Latitude,Longitude\r\n1,2,3,4,5,6,7,8,9,0,1,2")));
            _fileProvider.GetFileInfo(Arg.Any<string>()).Returns(file);
        }

        [TestInitialize]
        public void TestInitialize()
        {
            InitializeSubstitues();
            _fileProvider = Substitute.For<IFileProvider>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            _adapter = new CsvPointsOfInterestAdapter(_dataContainerConverterService, _fileProvider, _remoteFileFetcherGateway, Substitute.For<ILogger>());
            _adapter.SetFileName("csv.csv");
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldReturnOnePoint()
        {
            SetupFileStream();

            var features = _adapter.GetPointsForIndexing().Result;

            Assert.AreEqual(1, features.Count);
        }
    }
}
