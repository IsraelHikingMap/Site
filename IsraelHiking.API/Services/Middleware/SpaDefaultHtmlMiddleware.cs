using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;

namespace IsraelHiking.API.Services.Middleware;

/// <summary>
/// This middleware is responsible in returning the index.html file
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
        if (context.Request.Path.StartsWithSegments("/api"))
        {
            await _next.Invoke(context);
            return;
        }
        var indexFileInfo = _environment.WebRootFileProvider.GetFileInfo("/index.html");
        context.Response.ContentType = "text/html";
        context.Response.ContentLength = indexFileInfo.Length;
        await context.Response.SendFileAsync(indexFileInfo);
    }
}