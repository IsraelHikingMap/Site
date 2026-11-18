using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace IsraelHiking.API.Services.Middleware;

/// <summary>
/// This middleware is responsible in returning the index.csr.html file
/// </summary>
public class SpaDefaultHtmlMiddleware
{
    private readonly RequestDelegate _next;
    private readonly IWebHostEnvironment _environment;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="next"></param>
    /// <param name="environment"></param>
    public SpaDefaultHtmlMiddleware(RequestDelegate next,
        IWebHostEnvironment environment)
    {
        _next = next;
        _environment = environment;
    }
    /// <summary>
    /// Main middleware method required for asp.net
    /// </summary>
    /// <param name="context"></param>
    public async Task InvokeAsync(HttpContext context)
    {
        if (context.GetEndpoint() != null)
        {
            await _next.Invoke(context);
            return;
        }
        // A request for a file the browser was told to fetch, mainly a script or a style, should
        // end with a 404 and not with the html file, otherwise the browser fails on the mime type.
        // This happens when a page that was loaded before a deployment asks for a hashed file name
        // that no longer exists on the server.
        var destination = context.Request.Headers["Sec-Fetch-Dest"].ToString();
        if (destination != string.Empty && destination != "document" && destination != "iframe")
        {
            context.Response.StatusCode = StatusCodes.Status404NotFound;
            return;
        }
        var indexFileInfo = _environment.WebRootFileProvider.GetFileInfo("/index.csr.html");
        context.Response.ContentType = "text/html";
        // This file points at the hashed file names, so a cached copy of it breaks after a deployment.
        context.Response.Headers.CacheControl = "no-cache";
        context.Response.ContentLength = indexFileInfo.Length;
        await context.Response.SendFileAsync(indexFileInfo);
    }
}