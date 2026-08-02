using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class OfflineFilesServiceTests
{
    private const string OnTheFlyAddress = "https://mapeak.com/serve-extract/";
    private const string StyleAddress = "https://raw.githubusercontent.com/IsraelHikingMap/VectorMap/master/Styles/mapeak-hike.json";
    private const string Style = """
    {
        "sources": {
            "IHM": { "url": "https://mapeak.com/vector/data/IHM-schema.json" },
            "IHM-code": { "url": "https://mapeak.com/vector/data/IHM-code.json" },
            "DEM": { "url": "https://global.israelhikingmap.workers.dev/jaxa_terrarium0-11_v2.json" },
            "Contour": { "url": "https://global.israelhikingmap.workers.dev/JAXA_AW3D30_2024_contour_z5-Z12_vector.json" }
        }
    }
    """;
    // A future version of the style, where the DEM source is only an alias to the same file system file.
    private const string StyleWithAliasedDem = """
    {
        "sources": {
            "IHM": { "url": "https://mapeak.com/vector/data/IHM-schema.json" },
            "IHM-code": { "url": "https://mapeak.com/vector/data/IHM-code.json" },
            "DEM": {
                "url": "https://mapeak.com/raster-dem.json",
                "tiles": [ "https://mapeak.com/raster-dem/{z}/{x}/{y}.webp" ]
            },
            "Contour": { "url": "https://global.israelhikingmap.workers.dev/JAXA_AW3D30_2024_contour_z5-Z12_vector.json" }
        }
    }
    """;

    private OfflineFilesService _service;
    private IFileSystemHelper _fileSystemHelper;
    private IFileProvider _fileProvider;
    private IRemoteFileFetcherGateway _remoteFileFetcherGateway;

    [TestInitialize]
    public void TestInitialize()
    {
        _fileSystemHelper = Substitute.For<IFileSystemHelper>();
        _fileProvider = Substitute.For<IFileProvider>();
        _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
        _fileSystemHelper.CreateFileProvider(Arg.Any<string>()).Returns(_fileProvider);
        SetupStyleResponse(Style);
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData { OnTheFlyFilesAddress = OnTheFlyAddress });
        _service = new OfflineFilesService(_fileSystemHelper, _remoteFileFetcherGateway, options, Substitute.For<ILogger>());
    }

    private void SetupStyleResponse(string style)
    {
        _remoteFileFetcherGateway.GetFileContent(StyleAddress).Returns(new RemoteFileFetcherGatewayResponse
        {
            Content = Encoding.UTF8.GetBytes(style),
            FileName = "mapeak-hike.json"
        });
    }

    [TestMethod]
    public void ConstructWithoutFolder_ShouldNotCreateFileProviderAgain()
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData { OfflineFilesFolder = string.Empty });
        _service = new OfflineFilesService(_fileSystemHelper, _remoteFileFetcherGateway, options,
            Substitute.For<ILogger>());

        _fileSystemHelper.Received(1).CreateFileProvider(Arg.Any<string>());
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_Root_ShouldReturnOnlyOnTheFlyFilesWithTodaysDate()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null);

        Assert.HasCount(3, results);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-schema-6.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-code-6.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["global_points-6.pmtiles"]);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_Tile_ShouldReturnOnTheFlyAndJaxaFiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75);

        Assert.HasCount(4, results);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-schema+7-52-75.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-code+7-52-75.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["global_points+7-52-75.pmtiles"]);
        Assert.IsTrue(results.ContainsKey("jaxa_terrarium0-11_v2+7-52-75.pmtiles"));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_ShouldNotReturnContourFiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75);

        Assert.IsFalse(results.ContainsKey("JAXA_AW3D30_2024_contour_z5-Z12_vector+7-52-75.pmtiles"));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_JaxaFiles_ShouldUseFixedDates()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75);

        Assert.AreEqual(DateTimeOffset.Parse("2026-04-09T10:36:08.8024764Z").UtcDateTime,
            results["jaxa_terrarium0-11_v2+7-52-75.pmtiles"].ToUniversalTime());
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_EverythingUpToDate_ShouldReturnEmptyList()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.UtcNow.AddDays(1), 52, 75);

        Assert.IsEmpty(results);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_OnlyJaxaUpToDate_ShouldReturnOnlyOnTheFlyFiles()
    {
        // A last-modified between the fixed jaxa dates and today filters out jaxa but keeps the on-the-fly files.
        var results = await _service.GetUpdatedFilesList(new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc), 52, 75);

        Assert.HasCount(3, results);
        Assert.IsTrue(results.ContainsKey("IHM-schema+7-52-75.pmtiles"));
        Assert.IsFalse(results.ContainsKey("jaxa_terrarium0-11_v2+7-52-75.pmtiles"));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_ShouldNotReadFileSystem()
    {
        await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75);

        _fileProvider.DidNotReceive().GetDirectoryContents(Arg.Any<string>());
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_Twice_ShouldFetchTheStyleOnlyOnce()
    {
        await _service.GetUpdatedFilesList(DateTime.MinValue, null, null);
        await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75);

        await _remoteFileFetcherGateway.Received(1).GetFileContent(StyleAddress);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_StyleFetchFailsOnce_ShouldRetryAndSucceed()
    {
        _remoteFileFetcherGateway.GetFileContent(StyleAddress).Returns(
            _ => throw new Exception("some error"),
            _ => new RemoteFileFetcherGatewayResponse { Content = Encoding.UTF8.GetBytes(Style) });

        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null);

        Assert.HasCount(3, results);
        await _remoteFileFetcherGateway.Received(2).GetFileContent(StyleAddress);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_StyleFetchReturnsEmptyContent_ShouldRetryAndThrow()
    {
        _remoteFileFetcherGateway.GetFileContent(StyleAddress)
            .Returns(new RemoteFileFetcherGatewayResponse { Content = [] });

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _service.GetUpdatedFilesList(DateTime.MinValue, null, null));
        await _remoteFileFetcherGateway.Received(3).GetFileContent(StyleAddress);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_AliasedDemSource_ShouldReturnTheAliasNameWithTheFileSystemDate()
    {
        SetupStyleResponse(StyleWithAliasedDem);

        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75);

        Assert.HasCount(4, results);
        Assert.IsFalse(results.ContainsKey("jaxa_terrarium0-11_v2+7-52-75.pmtiles"));
        Assert.AreEqual(DateTimeOffset.Parse("2026-04-09T10:36:08.8024764Z").UtcDateTime,
            results["raster-dem+7-52-75.pmtiles"].ToUniversalTime());
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_AliasedDemSourceForRoot_ShouldNotReturnIt()
    {
        SetupStyleResponse(StyleWithAliasedDem);

        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null);

        Assert.HasCount(3, results);
        Assert.IsFalse(results.ContainsKey("raster-dem-6.pmtiles"));
    }

    [TestMethod]
    public async Task GetFileContent_AliasedDemFile_ShouldReadTheOriginalFileFromFileSystemAndNotProxy()
    {
        var fileInfo = Substitute.For<IFileInfo>();
        _fileProvider.GetFileInfo("7/1/2/jaxa_terrarium0-11_v2+7-1-2.pmtiles").Returns(fileInfo);

        await _service.GetFileContent("raster-dem+7-1-2.pmtiles", 1, 2);

        fileInfo.Received(1).CreateReadStream();
        await _remoteFileFetcherGateway.DidNotReceive().GetFileStream(Arg.Any<string>());
    }

    [TestMethod]
    public async Task GetFileContent_OnTheFlyFile_ShouldProxyFromRemoteService()
    {
        _remoteFileFetcherGateway.GetFileStream(Arg.Any<string>()).Returns(((Stream)new MemoryStream(), (long?)42));

        await _service.GetFileContent("IHM-schema+7-1-2.pmtiles", 1, 2);

        await _remoteFileFetcherGateway.Received(1).GetFileStream(OnTheFlyAddress + "IHM-schema+7-1-2.pmtiles");
    }

    [TestMethod]
    public async Task GetFileContent_OnTheFlyRootFile_ShouldProxyFromRemoteService()
    {
        _remoteFileFetcherGateway.GetFileStream(Arg.Any<string>()).Returns(((Stream)new MemoryStream(), (long?)42));

        await _service.GetFileContent("global_points-6.pmtiles", null, null);

        await _remoteFileFetcherGateway.Received(1).GetFileStream(OnTheFlyAddress + "global_points-6.pmtiles");
    }

    [TestMethod]
    public async Task GetFileContent_JaxaTileFile_ShouldReadFromFileSystemAndNotProxy()
    {
        var fileInfo = Substitute.For<IFileInfo>();
        _fileProvider.GetFileInfo("7/1/2/jaxa_terrarium0-11_v2+7-1-2.pmtiles").Returns(fileInfo);

        await _service.GetFileContent("jaxa_terrarium0-11_v2+7-1-2.pmtiles", 1, 2);

        fileInfo.Received(1).CreateReadStream();
        await _remoteFileFetcherGateway.DidNotReceive().GetFileStream(Arg.Any<string>());
    }

    [TestMethod]
    public async Task GetFileContent_JaxaRootFile_ShouldReadFromFileSystemAndNotProxy()
    {
        var fileInfo = Substitute.For<IFileInfo>();
        _fileProvider.GetFileInfo("jaxa_terrarium0-11_v2-6.pmtiles").Returns(fileInfo);

        await _service.GetFileContent("jaxa_terrarium0-11_v2-6.pmtiles", null, null);

        fileInfo.Received(1).CreateReadStream();
        await _remoteFileFetcherGateway.DidNotReceive().GetFileStream(Arg.Any<string>());
    }
}
