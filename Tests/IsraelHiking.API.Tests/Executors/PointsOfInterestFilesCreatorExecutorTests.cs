using System;
using System.IO;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class PointsOfInterestFilesCreatorExecutorTests
{
    private PointsOfInterestFilesCreatorExecutor _executor;
    private IFileSystemHelper _fileSystemHelper;

    [TestInitialize]
    public void TestInitialize()
    {
        _fileSystemHelper = Substitute.For<IFileSystemHelper>();
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        _executor = new PointsOfInterestFilesCreatorExecutor(
            _fileSystemHelper,
            Substitute.For<IWebHostEnvironment>(),
            options);
    }

    [TestMethod]
    public void CreateSiteMapXmlFile_ShouldCreatIt()
    {
        var feature = new Feature(new Point(0, 0), new AttributesTable
        {
            {FeatureAttributes.NAME + ":" + Languages.HEBREW, "Name"},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.ID, "id"}
        });
        feature.SetLastModified(DateTime.Now);
        var stream = new MemoryStream();
        _fileSystemHelper.CreateWriteStream(Arg.Any<string>()).Returns(stream);

        _executor.CreateSiteMapXmlFile([feature]);
            
        Assert.IsTrue(stream.ToArray().Length > 0);
    }

    [TestMethod]
    public void CreateOfflinePoisFile_ShouldCreatIt()
    {
        var feature = new Feature(new Point(0, 0), new AttributesTable
        {
            {FeatureAttributes.NAME + ":" + Languages.HEBREW, "Name"},
            {FeatureAttributes.POI_SOURCE, Sources.OSM},
            {FeatureAttributes.ID, "id"},
            {FeatureAttributes.POI_ID, "node_id"},
            {FeatureAttributes.IMAGE_URL, "image"},
            {FeatureAttributes.IMAGE_URL + "1", "image1"},
            {FeatureAttributes.IMAGE_URL + "2", "image2"}
        });
        feature.SetLastModified(DateTime.Now);

        _executor.CreateExternalPoisFile([feature]);

        _fileSystemHelper.Received(1).WriteAllBytes(Arg.Any<string>(), Arg.Any<byte[]>());
    }
}