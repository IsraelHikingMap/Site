using IsraelHiking.API.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class ClientDetailsExtensionsTests
{
    private static HttpRequest CreateRequest(string platform = null, string version = null, string deviceId = null)
    {
        var httpContext = new DefaultHttpContext();
        if (platform != null)
        {
            httpContext.Request.Headers[ClientDetailsExtensions.CLIENT_PLATFORM_HEADER] = platform;
        }
        if (version != null)
        {
            httpContext.Request.Headers[ClientDetailsExtensions.CLIENT_VERSION_HEADER] = version;
        }
        if (deviceId != null)
        {
            httpContext.Request.Headers[ClientDetailsExtensions.CLIENT_DEVICE_ID_HEADER] = deviceId;
        }
        return httpContext.Request;
    }

    [TestMethod]
    public void GetClientDetails_NoHeaders_ShouldBeUnknown()
    {
        Assert.AreEqual(ClientDetails.Unknown, CreateRequest().GetClientDetails());
        Assert.AreEqual(string.Empty, CreateRequest().GetClientDetails().Info);
    }

    [TestMethod]
    public void GetClientDetails_NoRequest_ShouldBeUnknown()
    {
        Assert.AreEqual(ClientDetails.Unknown, ((HttpRequest)null).GetClientDetails());
    }

    [TestMethod]
    public void GetClientDetails_BrowserReportingOnlyPlatform_ShouldReturnPlatform()
    {
        Assert.AreEqual("web", CreateRequest("web").GetClientDetails().Info);
    }

    [TestMethod]
    public void GetClientDetails_AppReportingPlatformAndVersion_ShouldReturnBoth()
    {
        Assert.AreEqual("android 9.21.2", CreateRequest("android", "9.21.2").GetClientDetails().Info);
    }

    [TestMethod]
    public void OsmInfo_App_ShouldNotTellWhichMobilePlatformItIs()
    {
        Assert.AreEqual("app 9.21.2", CreateRequest("android", "9.21.2").GetClientDetails().OsmInfo);
        Assert.AreEqual("app 9.21.2", CreateRequest("ios", "9.21.2").GetClientDetails().OsmInfo);
    }

    [TestMethod]
    public void OsmInfo_Browser_ShouldStayAsIs()
    {
        Assert.AreEqual("web", CreateRequest("web").GetClientDetails().OsmInfo);
    }

    [TestMethod]
    public void GetClientDetails_ClientReportingItsDevice_ShouldReturnItWithoutAddingItToTheDescriptions()
    {
        var details = CreateRequest("ios", "9.21.2", "3F2504E0-4F89-11D3-9A0C-0305E82C3301").GetClientDetails();

        Assert.AreEqual("3f2504e0-4f89-11d3-9a0c-0305e82c3301", details.DeviceId);
        Assert.AreEqual("ios 9.21.2", details.Info);
        Assert.AreEqual("app 9.21.2", details.OsmInfo);
    }

    [TestMethod]
    public void GetClientDetails_UnexpectedCharactersInTheDevice_ShouldRemoveThem()
    {
        Assert.AreEqual("some-device", CreateRequest(deviceId: "some-device <script>").GetClientDetails().DeviceId);
    }

    [TestMethod]
    public void GetClientDetails_UnexpectedCharacters_ShouldRemoveThem()
    {
        Assert.AreEqual("web 9.21.2", CreateRequest("web <script>", "9.21.2 <script>").GetClientDetails().Info);
    }

    [TestMethod]
    public void GetClientDetails_StartingWithUnexpectedCharacters_ShouldBeUnknown()
    {
        Assert.AreEqual(ClientDetails.Unknown, CreateRequest("<script>", "<script>").GetClientDetails());
    }

    [TestMethod]
    public void GetClientDetails_VeryLongValues_ShouldTruncateThem()
    {
        var details = CreateRequest(new string('a', 100), new string('1', 100), new string('1', 100)).GetClientDetails();

        Assert.AreEqual(16, details.Platform.Length);
        Assert.AreEqual(32, details.Version.Length);
        Assert.AreEqual(64, details.DeviceId.Length);
    }
}
