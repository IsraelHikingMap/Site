using System.IO;
using System.Text;
using IsraelHiking.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services;

[TestClass]
public class HomePageHelperTests
{
    const string HOME_PAGE_SAMPLE_CONTENT = @"<html><!-- MAPEAK START -->foo<!-- MAPEAK END --></html>";
    private HomePageHelper _homePageHelper;

    [TestInitialize]
    public void TestInitialize()
    {
        var hostingEnvironment = Substitute.For<IWebHostEnvironment>();
        var rootFolder = Substitute.For<IFileProvider>();
        var fileInfo = Substitute.For<IFileInfo>();
        var stream = new MemoryStream(Encoding.UTF8.GetBytes(HOME_PAGE_SAMPLE_CONTENT));
        fileInfo.CreateReadStream().Returns(stream);
        rootFolder.GetFileInfo("/index.html").Returns(fileInfo);
        hostingEnvironment.WebRootFileProvider.Returns(rootFolder);
        _homePageHelper = new HomePageHelper(hostingEnvironment);
    }


    [TestMethod]
    public void TestRender_Simple()
    {
        var s = _homePageHelper.Render("@TITLE@", "@DESC@", "@THUMB@");

        void Check(string needle)
        {
            StringAssert.Contains(s, needle, null, null);
        }

        Check("<title>@TITLE@");
        Check("<meta property=\"og:title\" content=\"@TITLE@");
        Check("<meta property=\"og:description\" content=\"@DESC@\"");
        Check("<meta property=\"og:image\" content=\"@THUMB@\"");
    }

    [TestMethod]
    public void TestRender_WithEscaping()
    {
        var s = _homePageHelper.Render("1<>\"2", "3<>\"4", "@THUMB@");

        void Check(string needle)
        {
            StringAssert.Contains(s, needle, null, null);
        }

        Check("<title>1&lt;&gt;&quot;2");
        Check("<meta property=\"og:title\" content=\"1&lt;&gt;&quot;2");
        Check("<meta property=\"og:description\" content=\"3&lt;&gt;&quot;4\"");
        Check("<meta property=\"og:image\" content=\"@THUMB@\"");
    }
}