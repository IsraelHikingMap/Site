using System;
using System.IO;
using System.Reflection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// Represents a request to log a message.
/// </summary>
public class LogRequest
{
    /// <summary>
    /// The message to log.
    /// </summary>
    public string Message { get; set; }
}

/// <summary>
/// Controller for logging events.
/// </summary>
[Route("api/[controller]")]
public class LogController : ControllerBase
{
    /// <summary>
    /// Logs a message.
    /// </summary>
    /// <param name="request"></param>
    /// <returns></returns>
    [HttpPost]
    public IActionResult Log([FromBody] LogRequest request)
    {
        // Handle the log request
        System.IO.File.AppendAllText(Path.Combine(Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location), "Logs/subscriptions.txt"), $"{DateTime.UtcNow.ToString("o")} | {request.Message}{Environment.NewLine}");
        return Ok();
    }
}