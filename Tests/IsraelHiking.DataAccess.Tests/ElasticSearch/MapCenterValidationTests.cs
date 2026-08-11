using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

[TestClass]
public class MapCenterValidationTests
{
    [TestMethod]
    public void ResolveMapCenter_BothCoordinatesInRange_IsUsed()
    {
        var center = ElasticSearchGateway.ResolveMapCenter(40.3120, -105.6457);

        Assert.IsTrue(center.HasValue);
        Assert.AreEqual(40.3120, center.Value.lat, 1e-9);
        Assert.AreEqual(-105.6457, center.Value.lng, 1e-9);
    }

    [TestMethod]
    public void ResolveMapCenter_NoCoordinates_IsAbsent()
    {
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(null, null).HasValue);
    }

    [TestMethod]
    public void ResolveMapCenter_HalfSuppliedCenter_IsRejectedRatherThanPartiallyForwarded()
    {
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(40.3120, null).HasValue,
            "a lat without a lon must not reach the script as a partial center");
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(null, -105.6457).HasValue);
    }

    [TestMethod]
    public void ResolveMapCenter_NaNOrInfinite_IsRejected()
    {
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(double.NaN, -105.6457).HasValue,
            "NaN must be rejected explicitly or it propagates through Math.Cos into the viewport box");
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(40.3120, double.NaN).HasValue);
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(double.PositiveInfinity, 0).HasValue);
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(0, double.NegativeInfinity).HasValue);
    }

    [TestMethod]
    public void ResolveMapCenter_OutOfRangeCoordinates_AreRejected()
    {
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(95, 0).HasValue);
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(-95, 0).HasValue);
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(0, 181).HasValue);
        Assert.IsFalse(ElasticSearchGateway.ResolveMapCenter(0, -181).HasValue);
    }

    [TestMethod]
    public void ResolveMapCenter_CoordinateExtremes_AreAccepted()
    {
        Assert.IsTrue(ElasticSearchGateway.ResolveMapCenter(90, 180).HasValue);
        Assert.IsTrue(ElasticSearchGateway.ResolveMapCenter(-90, -180).HasValue);
        Assert.IsTrue(ElasticSearchGateway.ResolveMapCenter(0, 0).HasValue,
            "null island is a valid center; only absent coordinates are not");
    }
}
