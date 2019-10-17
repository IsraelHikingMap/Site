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
        private IHttpGatewayFactory _httpGatewayFactory;
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
            _httpGatewayFactory = Substitute.For<IHttpGatewayFactory>();
            _fileProvider = Substitute.For<IFileProvider>();
            _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
            
            _httpGatewayFactory.CreateRemoteFileFetcherGateway(null).Returns(_remoteFileFetcherGateway);
            _adapter = new CsvPointsOfInterestAdapter(_elevationDataStorage, _elasticSearchGateway, _dataContainerConverterService, _itmWgs84MathTransfromFactory, _fileProvider, _httpGatewayFactory, _options, Substitute.For<ILogger>());
            _adapter.SetFileName("csv.csv");
        }

        [TestMethod]
        public void GetPointsForIndexing_ShouldReturnOnePoint()
        {
            SetupFileStream();

            var features = _adapter.GetPointsForIndexing().Result;

            Assert.AreEqual(1, features.Count);
        }

        [TestMethod]
        public void GetPointById_WithUrl_ShouldGetItFromCache()
        {
            var id = "1";
            var source = "csv";
            var fileUrl = "fileUrl";
            var dataContainer = new DataContainer { Routes = new List<RouteData> { new RouteData { Name = "name" } } };
            var feature = GetValidFeature(id, source);
            feature.Attributes.Add(FeatureAttributes.POI_SHARE_REFERENCE, fileUrl);
            feature.Attributes.Add(FeatureAttributes.POI_CACHE_DATE, DateTime.Now.AddDays(-1).ToString("o"));
            _elasticSearchGateway.GetCachedItemById(id, source).Returns(new FeatureCollection { feature });
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(dataContainer);

            var point = _adapter.GetPointOfInterestById(id, Languages.HEBREW).Result;

            Assert.IsNotNull(point);
            Assert.IsNotNull(point.DataContainer);
            Assert.AreEqual(dataContainer.Routes.Count, point.DataContainer.Routes.Count);
        }

        [TestMethod]
        public void GetPointById_WithUrl_ShouldGetItFromCsvFileAndFetchFile()
        {
            var id = "1";
            var source = "csv";
            var fileUrl = "fileUrl";
            var dataContainer = new DataContainer { Routes = new List<RouteData> { new RouteData { Name = "name" } } };
            var feature = GetValidFeature(id, source);
            feature.Attributes.Add(FeatureAttributes.POI_SHARE_REFERENCE, fileUrl);
            _elasticSearchGateway.GetCachedItemById(id, source).Returns(new FeatureCollection { feature });
            _remoteFileFetcherGateway.GetFileContent(Arg.Any<string>()).Returns(new RemoteFileFetcherGatewayResponse { FileName = fileUrl, Content = new byte[0] });
            _dataContainerConverterService.Convert(Arg.Any<byte[]>(), fileUrl, FlowFormats.GEOJSON).Returns(new FeatureCollection { feature }.ToBytes());
            _dataContainerConverterService.ToDataContainer(Arg.Any<byte[]>(), Arg.Any<string>()).Returns(dataContainer);
            SetupFileStream();

            var point = _adapter.GetPointOfInterestById(id, Languages.HEBREW).Result;

            Assert.IsNotNull(point);
            Assert.IsNotNull(point.DataContainer);
            Assert.AreEqual(dataContainer.Routes.Count, point.DataContainer.Routes.Count);
            _elasticSearchGateway.Received(1).CacheItem(Arg.Any<FeatureCollection>());
        }
    }
}
