using System.Linq;
using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Executors;

[TestClass]
public class UnauthorizedImageUrlsRemoverTests
{
    private IUnauthorizedImageUrlsRemover _remover;

    [TestInitialize]
    public void TestInitialize()
    {
        var options = Substitute.For<IOptions<ConfigurationData>>();
        options.Value.Returns(new ConfigurationData());
        _remover = new UnauthorizedImageUrlsRemover(options, Substitute.For<ILogger>());
    }

    [TestMethod]
    public void RemoveUnauthorizedImageUrls_ShouldRemoveTheImageAndTheImageSource()
    {
        var feature = new Feature(new Point(0, 0), new AttributesTable
        {
            { FeatureAttributes.POI_ID, "some-id" },
            { FeatureAttributes.IMAGE_URL, "unauthorized.png" },
            { FeatureAttributes.POI_SOURCE_IMAGE_URL, "unauthorized-source" },
            { FeatureAttributes.IMAGE_URL + "1", "wikimedia.org/authorized-image.png" },
            { FeatureAttributes.POI_SOURCE_IMAGE_URL + "1", "wikimedia.org" },
        });
        
        _remover.RemoveImages([feature]);

        Assert.AreEqual(1, feature.Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.IMAGE_URL)));
        Assert.AreEqual(1, feature.Attributes.GetNames().Count(n => n.StartsWith(FeatureAttributes.POI_SOURCE_IMAGE_URL)));
    }
    
}