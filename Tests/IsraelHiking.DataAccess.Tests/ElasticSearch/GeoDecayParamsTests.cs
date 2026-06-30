using Microsoft.VisualStudio.TestTools.UnitTesting;
using IsraelHiking.DataAccess.ElasticSearch;

namespace IsraelHiking.DataAccess.Tests.ElasticSearch;

/// <summary>
/// Guards the zoom &lt;= 0 handling in the geo-decay parameters. A request with no usable zoom defaults
/// to <c>double zoom = 0</c> at the controller; treating that 0 as a real (world-view) zoom would make
/// the painless decay scale collapse to a ~200 m radius and bury every non-adjacent hit. Both the
/// viewport math and the script zoom must fall back to the same DEFAULT_ZOOM instead.
/// </summary>
[TestClass]
public class GeoDecayParamsTests
{
    [TestMethod]
    public void ComputeGeoDecayParams_ZoomZero_FallsBackToDefaultZoomNotATinyRadius()
    {
        var atZero = ElasticSearchGateway.ComputeGeoDecayParams(0);
        var atDefault = ElasticSearchGateway.ComputeGeoDecayParams(12);

        // zoom=0 must NOT be taken literally (which would give the tightest possible radius); it must
        // resolve to the same parameters as the default zoom.
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
    public void ComputeGeoDecayParams_RealZoom_TightensRadiusAsZoomIncreases()
    {
        // Higher zoom (more zoomed in) => smaller plateau/offset (proximity matters more).
        var cityZoom = ElasticSearchGateway.ComputeGeoDecayParams(14);
        var regionZoom = ElasticSearchGateway.ComputeGeoDecayParams(8);

        Assert.IsTrue(cityZoom.offsetKm < regionZoom.offsetKm,
            "a more zoomed-in view should have a smaller full-score plateau");
    }
}
