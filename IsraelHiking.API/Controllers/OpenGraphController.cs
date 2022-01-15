﻿using IsraelHiking.API.Services;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers
{
    /// <inheritdoc />
    /// <summary>
    /// This contoller is used to return an HTML page for facebook crawler
    /// </summary>
    [Route("api/[controller]")]
    public class OpenGraphController : ControllerBase
    {
        private readonly ILogger _logger;
        private readonly IShareUrlsRepository _repository;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        /// <param name="logger"></param>
        public OpenGraphController(IShareUrlsRepository repository, 
            ILogger logger)
        {
            _repository = repository;
            _logger = logger;
        }

        /// <summary>
        /// Get the HTML page needed for facebook crawler
        /// </summary>
        /// <param name="id">The ID of the shared route</param>
        /// <returns>An HTML page with all relevant metadata</returns>
        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> GetHtml(string id)
        {
            _logger.LogDebug("Received a call to get html for: " + id);
            var url = await _repository.GetUrlById(id);
            var title = string.IsNullOrWhiteSpace(url.Title) ? "Israel Hiking Map Route Share" : url.Title;
            var contentResult = new ContentResult
            {
                Content = NonApiMiddleware.GetPage(title, "https://israelhiking.osm.org.il/api/images/" + url.Id, url.Description),
                ContentType = "text/html"
            };
            return contentResult;
        }
    }
}
