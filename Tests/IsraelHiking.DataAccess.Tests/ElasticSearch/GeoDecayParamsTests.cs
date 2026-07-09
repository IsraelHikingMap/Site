using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

[TestClass]
public class GeoDecayParamsTests
{
    [TestMethod]
    public void ComputeGeoDecayParams_ZoomZero_FallsBackToDefaultZoomNotATinyRadius()
    {
        var atZero = ElasticSearchGateway.ComputeGeoDecayParams(0);
        var atDefault = ElasticSearchGateway.ComputeGeoDecayParams(12);

        Assert.AreEqual(atDefault.scaleKm, atZero.scaleKm, 1e-9,
            "zoom=0 (no usable zoom) must fall back to DEFAULT_ZOOM, not a literal world view");
        Assert.AreEqual(atDefault.offsetKm, atZero.offsetKm, 1e-9);
    }

    [TestMethod]
    public void ComputeGeoDecayParams_NegativeZoom_AlsoFallsBack()
    {
        var atNegative = ElasticSearchGateway.ComputeGeoDecayParams(-3);
        var atDefault = ElasticSearchGateway.ComputeGeoDecayParams(12);

        Assert.AreEqual(atDefault.scaleKm, atNegative.scaleKm, 1e-9);
        Assert.AreEqual(atDefault.offsetKm, atNegative.offsetKm, 1e-9);
    }

    [TestMethod]
    public void ComputeGeoDecayParams_NullZoom_FallsBackToDefaultZoom()
    {
        var atNull = ElasticSearchGateway.ComputeGeoDecayParams(null);
        var atDefault = ElasticSearchGateway.ComputeGeoDecayParams(12);

        Assert.AreEqual(atDefault.scaleKm, atNull.scaleKm, 1e-9,
            "an absent zoom must fall back to DEFAULT_ZOOM");
        Assert.AreEqual(atDefault.offsetKm, atNull.offsetKm, 1e-9);
    }

    [TestMethod]
    public void ComputeGeoDecayParams_NaNZoom_FallsBackInsteadOfPoisoningTheMath()
    {
        var atNaN = ElasticSearchGateway.ComputeGeoDecayParams(double.NaN);
        var atDefault = ElasticSearchGateway.ComputeGeoDecayParams(12);

        Assert.AreEqual(atDefault.scaleKm, atNaN.scaleKm, 1e-9,
            "NaN <= 0 is false, so NaN must be rejected explicitly or it propagates through the decay math");
        Assert.AreEqual(atDefault.offsetKm, atNaN.offsetKm, 1e-9);
    }

    [TestMethod]
    public void ComputeGeoDecayParams_InfiniteZoom_IsCappedAtMaxZoom()
    {
        var atInfinity = ElasticSearchGateway.ComputeGeoDecayParams(double.PositiveInfinity);
        var atMax = ElasticSearchGateway.ComputeGeoDecayParams(22);

        Assert.AreEqual(atMax.scaleKm, atInfinity.scaleKm, 1e-9);
        Assert.AreEqual(atMax.offsetKm, atInfinity.offsetKm, 1e-9);
    }

    [TestMethod]
    public void ComputeGeoDecayParams_ImplausiblyDeepZoom_IsCappedAtMaxZoom()
    {
        var beyondMax = ElasticSearchGateway.ComputeGeoDecayParams(30);
        var atMax = ElasticSearchGateway.ComputeGeoDecayParams(22);

        Assert.AreEqual(atMax.scaleKm, beyondMax.scaleKm, 1e-9,
            "a zoom past MAX_ZOOM must clamp, not grow the decay radius without bound");
        Assert.AreEqual(atMax.offsetKm, beyondMax.offsetKm, 1e-9);
    }

    [TestMethod]
    public void ComputeGeoDecayParams_RealZoom_TightensRadiusAsZoomIncreases()
    {
        var cityZoom = ElasticSearchGateway.ComputeGeoDecayParams(14);
        var regionZoom = ElasticSearchGateway.ComputeGeoDecayParams(8);

        Assert.IsTrue(cityZoom.offsetKm < regionZoom.offsetKm,
            "a more zoomed-in view should have a smaller full-score plateau");
    }
}
