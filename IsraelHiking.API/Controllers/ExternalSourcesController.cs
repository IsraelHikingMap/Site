using IsraelHiking.API.Executors;
using IsraelHiking.API.Services.Poi;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// This contoller is responsible for external sourcing mirroning
/// </summary>
[Route("api/[controller]")]
[ApiController]
public class ExternalSourcesController : ControllerBase
{
    private readonly IPointsOfInterestAdapterFactory _adaptersFactory;
    private readonly IExternalSourceUpdaterExecutor _externalSourceUpdaterExecutor;

    /// <summary>
    /// Class constructor
    /// </summary>
    /// <param name="adaptersFactory"></param>
    /// <param name="externalSourceUpdaterExecutor"></param>
    public ExternalSourcesController(IPointsOfInterestAdapterFactory adaptersFactory,
        IExternalSourceUpdaterExecutor externalSourceUpdaterExecutor)
    {
        _adaptersFactory = adaptersFactory;
        _externalSourceUpdaterExecutor = externalSourceUpdaterExecutor;
    }

    /// <summary>
    /// Get external sources
    /// </summary>
    /// <remarks>Returns the list of all external sources currently available for mirroring.</remarks>
    /// <returns></returns>
    [HttpGet]
    public IEnumerable<string> GetSources()
    {
        return _adaptersFactory.GetAll().Select(a => a.Source);
    }

    /// <summary>
    /// Rebuild an external source
    /// </summary>
    /// <remarks>Fully re-extracts the given external source, replacing its mirrored data.</remarks>
    /// <param name="source"></param>
    /// <returns></returns>
    [HttpPost]
    public async Task<IActionResult> PostRebuildSource(string source)
    {
        if (!GetSources().Contains(source))
        {
            return NotFound($"Source {source} does not exist");
        }
        await _externalSourceUpdaterExecutor.RebuildSource(source);
        return Ok();
    }

    /// <summary>
    /// Update an external source
    /// </summary>
    /// <remarks>Fetches and applies changes for the given external source since it was last updated.</remarks>
    /// <param name="source"></param>
    /// <returns></returns>
    [HttpPut]
    public async Task<IActionResult> PutUpdateSource(string source)
    {
        if (!GetSources().Contains(source))
        {
            return NotFound($"Source {source} does not exist");
        }
        await _externalSourceUpdaterExecutor.UpdateSource(source);
        return Ok();
    }
}