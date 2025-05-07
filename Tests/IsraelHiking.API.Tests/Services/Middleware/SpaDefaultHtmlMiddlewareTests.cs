using System.IO;
using IsraelHiking.API.Services.Middleware;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Middleware;

[TestClass]
public class SpaDefaultHtmlMiddlewareTests
{
    private SpaDefaultHtmlMiddleware _middleware;
    private IWebHostEnvironment _environment;
    private RequestDelegate _next;
    
    [TestInitialize]
    public void TestInitialize()
    {
        _next = Substitute.For<RequestDelegate>();
        _environment = Substitute.For<IWebHostEnvironment>();
        _middleware = new SpaDefaultHtmlMiddleware(_next, _environment);
    }
    
    [TestMethod]
    public void TestAPI_ShouldPassThrough()
    {
        var context = new DefaultHttpContext
        {
            Request =
            {
                Path = new PathString("/api/something"),
                Host = new HostString("www.example.com"),
                QueryString = QueryString.Empty,
                PathBase = PathString.Empty,
                Scheme = "http"
            }
        };

        _middleware.InvokeAsync(context).Wait();

        _next.Received().Invoke(context);
    }
    
    [TestMethod]
    public void TestOther_ShouldReturnHtmlFile()
    {
        var context = new DefaultHttpContext
        {
            Request =
            {
                Path = new PathString("/pther"),
                Host = new HostString("www.example.com"),
                QueryString = QueryString.Empty,
                PathBase = PathString.Empty,
                Scheme = "http"
            }
        };
        var fileInfo = Substitute.For<IFileInfo>();
        fileInfo.CreateReadStream().Returns(new MemoryStream([1]));
        _environment.WebRootFileProvider.GetFileInfo(Arg.Any<string>()).Returns(fileInfo);
        
        _middleware.InvokeAsync(context).Wait();

        _next.DidNotReceive().Invoke(context);
    }
}