using System;
using System.IO;
using IsraelHiking.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.FileProviders;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services
{
    [TestClass]
    public class HomePageHelperTests
    {
        private IWebHostEnvironment _hostingEnvironment;
        private HomePageHelper _homePageHelper;

        [TestInitialize]
        public void TestInitialize()
        {
            _hostingEnvironment = Substitute.For<IWebHostEnvironment>();
            var fileProvider =
                new PhysicalFileProvider(Path.Combine(AppContext.BaseDirectory,
                    "../../../../../IsraelHiking.Web/wwwroot"));
            _hostingEnvironment.WebRootFileProvider.Returns(fileProvider);
            _homePageHelper = new HomePageHelper(_hostingEnvironment);
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
            Check( "<meta property=\"og:title\" content=\"@TITLE@");
            Check( "<meta property=\"og:description\" content=\"@DESC@\"");
            Check( "<meta property=\"og:image\" content=\"@THUMB@\"");
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
            Check( "<meta property=\"og:title\" content=\"1&lt;&gt;&quot;2");
            Check( "<meta property=\"og:description\" content=\"3&lt;&gt;&quot;4\"");
            Check( "<meta property=\"og:image\" content=\"@THUMB@\"");
        }
    }
}