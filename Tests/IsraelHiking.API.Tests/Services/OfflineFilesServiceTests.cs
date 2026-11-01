using System;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class OfflineFilesServiceTests
{
    private const string OnTheFlyAddress = "https://mapeak.com/serve-extract/";
    private const string OnTheFlyDemAddress = "http://go-pmtiles-extract-dem:8080/";
    private const string RoutingTilesAddress = "https://mapeak.com/routing-tiles/";
    private const string StylesAddress = "https://mapeak.com/styles/";
    private const string StyleAddress = StylesAddress + "mapeak-hike.json";
    private const string Style = """
    {
        "sources": {
            "IHM": { "url": "https://mapeak.com/vector/data/IHM-schema.json" },
            "IHM-code": { "url": "https://mapeak.com/vector/data/IHM-code.json" },
            "DEM": { "url": "https://mapeak.com/vector/data/raster-dem.json" },
            "Contour": { "url": "https://global.israelhikingmap.workers.dev/JAXA_AW3D30_2024_contour_z5-Z12_vector.json" }
        }
    }
    """;

    private OfflineFilesService _service;
    private IRemoteFileFetcherGateway _remoteFileFetcherGateway;
    private string _valhallaProfilesFilePath;

    [TestInitialize]
    public void TestInitialize()
    {
        _remoteFileFetcherGateway = Substitute.For<IRemoteFileFetcherGateway>();
        SetupStyleResponse(Style);
        _valhallaProfilesFilePath = Path.Combine(Path.GetTempPath(), Path.GetRandomFileName());
        File.WriteAllText(_valhallaProfilesFilePath, "{ \"foot\": {} }");
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData
        {
            OnTheFlyFilesAddress = OnTheFlyAddress,
            OnTheFlyDemAddress = OnTheFlyDemAddress,
            RoutingTilesAddress = RoutingTilesAddress,
            ValhallaProfilesFilePath = _valhallaProfilesFilePath
        });
        _service = new OfflineFilesService(_remoteFileFetcherGateway, options, Substitute.For<ILogger>());
    }

    [TestCleanup]
    public void TestCleanup()
    {
        File.Delete(_valhallaProfilesFilePath);
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
    public async Task GetUpdatedFilesList_Root_ShouldReturnOnlyOnTheFlyFilesWithTodaysDate()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, false);

        Assert.HasCount(3, results);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-schema-6.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-code-6.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["global_points-6.pmtiles"]);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_Tile_ShouldReturnOnTheFlyAndDemFiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, false);

        Assert.HasCount(4, results);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-schema+7-52-75.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["IHM-code+7-52-75.pmtiles"]);
        Assert.AreEqual(DateTime.UtcNow.Date, results["global_points+7-52-75.pmtiles"]);
        Assert.IsTrue(results.ContainsKey("raster-dem+7-52-75.pmtiles"));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_TileWithValhalla_ShouldAlsoReturnTheValhallaFile()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, true);

        Assert.HasCount(5, results);
        Assert.AreEqual(DateTime.UtcNow.Date, results["valhalla+7-52-75.tgz"]);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_TileWithoutValhalla_ShouldNotReturnTheValhallaFile()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, false);

        Assert.IsFalse(results.Keys.Any(k => k.StartsWith("valhalla")));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_RootWithValhalla_ShouldNotReturnTheValhallaTileFile()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, true);

        Assert.IsFalse(results.Keys.Any(k => k.EndsWith(".tgz")));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_RootWithValhalla_ShouldAlsoReturnTheValhallaProfiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, true);

        Assert.HasCount(4, results);
        Assert.AreEqual(DateTime.UtcNow.Date, results["valhalla-profiles.json"]);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_RootWithoutValhalla_ShouldNotReturnTheValhallaProfiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, false);

        Assert.IsFalse(results.Keys.Any(k => k.EndsWith(".json")));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_TileWithValhalla_ShouldNotReturnTheValhallaProfiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, true);

        Assert.IsFalse(results.Keys.Any(k => k.EndsWith(".json")));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_RootOnlyFilesUpToDate_ShouldNotReturnThem()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.UtcNow.AddDays(1), null, null, true);

        Assert.IsEmpty(results);
    }

    [TestMethod]
    public async Task GetFileContent_ValhallaProfilesFile_ShouldBeReadFromTheConfiguredPath()
    {
        var (content, _) = await _service.GetFileContent("valhalla-profiles.json", null, null);

        using var reader = new StreamReader(content);
        Assert.AreEqual(File.ReadAllText(_valhallaProfilesFilePath), await reader.ReadToEndAsync());
        await _remoteFileFetcherGateway.DidNotReceive().GetFileStream(Arg.Any<string>());
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_ValhallaUpToDate_ShouldNotReturnTheValhallaFile()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.UtcNow.AddDays(1), 52, 75, true);

        Assert.IsFalse(results.Keys.Any(k => k.StartsWith("valhalla")));
    }

    [TestMethod]
    public async Task GetFileContent_ValhallaFile_ShouldBeFetchedFromTheRoutingTilesServer()
    {
        _remoteFileFetcherGateway.GetFileStream(Arg.Any<string>()).Returns((new MemoryStream() as Stream, (long?)0));

        await _service.GetFileContent("valhalla+7-52-75.tgz", 52, 75);

        await _remoteFileFetcherGateway.Received(1).GetFileStream(RoutingTilesAddress + "valhalla+7-52-75.tgz");
    }

    [TestMethod]
    public async Task GetFileContent_NonValhallaFile_ShouldBeFetchedFromTheOnTheFlyServer()
    {
        _remoteFileFetcherGateway.GetFileStream(Arg.Any<string>()).Returns((new MemoryStream() as Stream, (long?)0));

        await _service.GetFileContent("IHM-schema+7-52-75.pmtiles", 52, 75);

        await _remoteFileFetcherGateway.Received(1).GetFileStream(OnTheFlyAddress + "IHM-schema+7-52-75.pmtiles");
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_ShouldNotReturnContourFiles()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, false);

        Assert.IsFalse(results.ContainsKey("JAXA_AW3D30_2024_contour_z5-Z12_vector+7-52-75.pmtiles"));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_DemFile_ShouldUseFixedDate()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, false);

        Assert.AreEqual(DateTimeOffset.Parse("2026-11-07T00:00:00Z").UtcDateTime,
            results["raster-dem+7-52-75.pmtiles"].ToUniversalTime());
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_EverythingUpToDate_ShouldReturnEmptyList()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.UtcNow.AddYears(1), 52, 75, false);

        Assert.IsEmpty(results);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_DemUpToDate_ShouldNotReturnTheDemFile()
    {
        var results = await _service.GetUpdatedFilesList(DateTimeOffset.Parse("2026-11-07T00:00:00Z").UtcDateTime, 52, 75, false);

        Assert.IsFalse(results.ContainsKey("raster-dem+7-52-75.pmtiles"));
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_Twice_ShouldFetchTheStyleOnlyOnce()
    {
        await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, false);
        await _service.GetUpdatedFilesList(DateTime.MinValue, 52, 75, false);

        await _remoteFileFetcherGateway.Received(1).GetFileContent(StyleAddress);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_StyleFetchFailsOnce_ShouldRetryAndSucceed()
    {
        _remoteFileFetcherGateway.GetFileContent(StyleAddress).Returns(
            _ => throw new Exception("some error"),
            _ => new RemoteFileFetcherGatewayResponse { Content = Encoding.UTF8.GetBytes(Style) });

        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, false);

        Assert.HasCount(3, results);
        await _remoteFileFetcherGateway.Received(2).GetFileContent(StyleAddress);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_StyleFetchReturnsEmptyContent_ShouldRetryAndThrow()
    {
        _remoteFileFetcherGateway.GetFileContent(StyleAddress)
            .Returns(new RemoteFileFetcherGatewayResponse { Content = [] });

        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() => _service.GetUpdatedFilesList(DateTime.MinValue, null, null, false));
        await _remoteFileFetcherGateway.Received(3).GetFileContent(StyleAddress);
    }

    [TestMethod]
    public async Task GetUpdatedFilesList_DemSourceForRoot_ShouldNotReturnIt()
    {
        var results = await _service.GetUpdatedFilesList(DateTime.MinValue, null, null, false);

        Assert.HasCount(3, results);
        Assert.IsFalse(results.ContainsKey("raster-dem-6.pmtiles"));
    }

    [TestMethod]
    public async Task GetFileContent_DemFile_ShouldBeFetchedFromTheDemServer()
    {
        _remoteFileFetcherGateway.GetFileStream(Arg.Any<string>()).Returns(((Stream)new MemoryStream(), (long?)42));

        await _service.GetFileContent("raster-dem+7-1-2.pmtiles", 1, 2);

        await _remoteFileFetcherGateway.Received(1).GetFileStream(OnTheFlyDemAddress + "raster-dem+7-1-2.pmtiles");
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
}
