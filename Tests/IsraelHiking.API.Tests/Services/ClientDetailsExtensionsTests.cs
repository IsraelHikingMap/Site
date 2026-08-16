using IsraelHiking.API.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class ClientDetailsExtensionsTests
{
    private static HttpRequest CreateRequest(string platform = null, string version = null)
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
        var details = CreateRequest(new string('a', 100), new string('1', 100)).GetClientDetails();

        Assert.AreEqual(16, details.Platform.Length);
        Assert.AreEqual(32, details.Version.Length);
    }
}
