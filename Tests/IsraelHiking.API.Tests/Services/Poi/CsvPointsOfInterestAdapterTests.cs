using IsraelHiking.API.Gpx;
using IsraelHiking.API.Services.Poi;
using IsraelHiking.Common.Api;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NSubstitute;
using System;
using System.Linq;
using System.Text;
using IsraelHiking.Common;

namespace IsraelHiking.API.Tests.Services.Poi;

[TestClass]
public class CsvPointsOfInterestAdapterTests : BasePointsOfInterestAdapterTestsHelper
{
    private CsvPointsOfInterestAdapter _adapter;
    private IRemoteFileFetcherGateway _remoteFileFetcherGateway;

    private void SetupFileStream(string address, string content = null)
    {
        var bytes = Encoding.UTF8.GetBytes(content ??
                                           "Id,Title,Description,Website,ImageUrl,SourceImageUrl,Category,FileUrl,Icon,IconColor,Latitude,Longitude,LastModified\r\n1,2,3,4,5,6,7,8,9,0,1,2,2013-3-31");
        _remoteFileFetcherGateway.GetFileContent(address).Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = bytes,
            FileName = ""
        });
    }

    [TestInitialize]
    public void TestInitialize()
    {
        InitializeSubstitutes();
        _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
        _adapter = new CsvPointsOfInterestAdapter(_dataContainerConverterService, _remoteFileFetcherGateway, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void GetAll_ShouldReturnOnePoint()
    {
        var address = "http://csv.csv";
        _adapter.SetFileNameAndAddress("csv.csv", address);
        SetupFileStream(address);
        _remoteFileFetcherGateway.GetFileContent("8").Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = new FeatureCollection().ToBytes(),
            FileName = "csv.geojson"
        });
        _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(new FeatureCollection().ToBytes());

        var features = _adapter.GetAll().Result;

        Assert.AreEqual(1, features.Count);
    }
        
    public void GetAll_MissingImage_ShouldReturnOnePointWithNoImageField()
    {
        var address = "http://csv.csv";
        _adapter.SetFileNameAndAddress("csv.csv", address);
        SetupFileStream(address,
            "Id,Title,Description,Website,ImageUrl,SourceImageUrl,Category,FileUrl,Icon,IconColor,Latitude,Longitude,LastModified\r\n1,2,3,4,,6,7,8,9,0,1,2,2013-3-31");
        _remoteFileFetcherGateway.GetFileContent("8").Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = new FeatureCollection().ToBytes(),
            FileName = "csv.geojson"
        });
        _dataContainerConverterService.Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>()).Returns(new FeatureCollection().ToBytes());

        var features = _adapter.GetAll().Result;

        Assert.AreEqual(1, features.Count);
        Assert.IsFalse(features.First().Attributes.Exists(FeatureAttributes.IMAGE_URL));
    }

    [TestMethod]
    public void GetLastModified_ShouldReturnNone()
    {
        var address = "http://csv.csv";
        _adapter.SetFileNameAndAddress("csv.csv", address);
        SetupFileStream(address);

        var features = _adapter.GetUpdates(DateTime.Now).Result;

        Assert.AreEqual(0, features.Count);
        _remoteFileFetcherGateway.DidNotReceive().GetFileContent("8");
        _dataContainerConverterService.DidNotReceive().Convert(Arg.Any<byte[]>(), Arg.Any<string>(), Arg.Any<string>());
    }
}