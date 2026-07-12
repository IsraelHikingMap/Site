using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

[TestClass]
public class WrapLongitudeTests
{
    [TestMethod]
    public void WrapLongitude_InRangeValues_AreUnchanged()
    {
        Assert.AreEqual(0.0, ElasticSearchGateway.WrapLongitude(0.0), 1e-9);
        Assert.AreEqual(-111.5, ElasticSearchGateway.WrapLongitude(-111.5), 1e-9);
        Assert.AreEqual(35.2, ElasticSearchGateway.WrapLongitude(35.2), 1e-9);
    }

    [TestMethod]
    public void WrapLongitude_BeyondAntimeridian_WrapsToOppositeSign()
    {
        Assert.AreEqual(-170.0, ElasticSearchGateway.WrapLongitude(190.0), 1e-9);
        Assert.AreEqual(170.0, ElasticSearchGateway.WrapLongitude(-190.0), 1e-9);
    }

    [TestMethod]
    public void WrapLongitude_ViewportEdgesAroundDateline_ProduceCrossingBox()
    {
        var left = ElasticSearchGateway.WrapLongitude(179.8 - 5.0);
        var right = ElasticSearchGateway.WrapLongitude(179.8 + 5.0);

        Assert.AreEqual(174.8, left, 1e-9);
        Assert.AreEqual(-175.2, right, 1e-9);
        Assert.IsTrue(left > right, "left > right is how Elasticsearch encodes a dateline-crossing box");
    }

    [TestMethod]
    public void WrapLongitude_FullTurns_AreNormalized()
    {
        Assert.AreEqual(10.0, ElasticSearchGateway.WrapLongitude(370.0), 1e-9);
        Assert.AreEqual(-10.0, ElasticSearchGateway.WrapLongitude(-370.0), 1e-9);
    }
}
