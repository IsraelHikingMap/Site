using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Linq;
using System.Threading.Tasks;
using IsraelHiking.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Net.Http.Headers;
using System.Collections.Generic;

namespace IsraelHiking.API.Controllers
{
    /// <inheritdoc />
    /// <summary>
    /// This controller handles the shared routes
    /// </summary>
    [Route("api/[controller]")]
    public class UrlsController : Controller
    {
        private readonly IRepository _repository;
        private readonly IDataContainerConverterService _dataContainerConverterService;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        /// <param name="dataContainerConverterService"></param>
        public UrlsController(IRepository repository, 
            IDataContainerConverterService dataContainerConverterService)
        {
            _repository = repository;
            _dataContainerConverterService = dataContainerConverterService;
        }

        /// <summary>
        /// Returns the data relevant to a given shared route
        /// </summary>
        /// <param name="id">The shared route ID</param>
        /// <param name="format">The format to convert to, default is <see cref="DataContainer"/>, but you can use "gpx", "csv" and all other formats that can be opened in this site</param>
        /// <returns>The shared route in the requested format</returns>
        // GET api/Urls/abc?format=gpx
        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> GetShareUrl(string id, string format = "")
        {
            var shareUrl = await _repository.GetUrlById(id);
            if (shareUrl == null)
            {
                return BadRequest();
            }
            shareUrl.LastViewed = DateTime.Now;
            shareUrl.ViewsCount++;
            await _repository.Update(shareUrl);
            if (string.IsNullOrWhiteSpace(format))
            {
                return Ok(shareUrl);
            }
            return await GetUrlAsFile(id, format, shareUrl);
        }

        private async Task<IActionResult> GetUrlAsFile(string id, string format, ShareUrl shareUrl)
        {
            var bytes = await _dataContainerConverterService.ToAnyFormat(shareUrl.DataContainer, format);
            var restuls = new FileContentResult(bytes, new MediaTypeHeaderValue($"application/{format}"))
            {
                FileDownloadName = id + "." + format
            };
            return restuls;
        }

        /// <summary>
        /// Get all shared routes for a specific user
        /// </summary>
        /// <returns>The user's shared routes</returns>
        // GET api/Urls
        [Authorize]
        [HttpGet]
        [ProducesResponseType(typeof(IEnumerable<ShareUrl>), 200)]
        public async Task<IActionResult> GetShareUrlForUser()
        {
            var shareUrls = await _repository.GetUrlsByUser(User.Identity.Name);
            return Ok(shareUrls.OrderByDescending(d => d.CreationDate));
        }

        /// <summary>
        /// Adds a shared route, user ID is optional
        /// </summary>
        /// <param name="shareUrl">The shared route's data</param>
        /// <returns>Whether the operation succeeded or not</returns>
        // POST api/urls
        [HttpPost]
        [ProducesResponseType(typeof(ShareUrl), 200)]
        public async Task<IActionResult> PostShareUrl([FromBody]ShareUrl shareUrl)
        {
            if (string.IsNullOrWhiteSpace(shareUrl.OsmUserId) == false && shareUrl.OsmUserId != User.Identity.Name)
            {
                return BadRequest("You can't create a share as someone else!");
            }
            var random = new Random(Guid.NewGuid().GetHashCode());
            shareUrl.CreationDate = DateTime.Now;
            shareUrl.LastViewed = DateTime.Now;
            shareUrl.ViewsCount = 0;
            var id = GetRandomString(10, random);
            while (await _repository.GetUrlById(id) != null)
            {
                id = GetRandomString(10, random);
            }
            shareUrl.Id = id;
            await _repository.AddUrl(shareUrl);
            return Ok(shareUrl);
        }

        /// <summary>
        /// Update a shared route
        /// </summary>
        /// <param name="id">The shared route's ID</param>
        /// <param name="shareUrl">The new shared route data</param>
        /// <returns>Whether the operation succeeded or not</returns>
        // PUT api/urls/42
        [Authorize]
        [HttpPut]
        [Route("{id}")]
        [ProducesResponseType(typeof(ShareUrl), 200)]
        public async Task<IActionResult> PutShareUrl(string id, [FromBody]ShareUrl shareUrl)
        {
            var shareUrlFromDatabase = await _repository.GetUrlById(id);
            if (shareUrlFromDatabase == null)
            {
                return NotFound();
            }
            if (shareUrlFromDatabase.OsmUserId != User.Identity.Name)
            {
                return BadRequest("You can't update someone else's share!");
            }
            shareUrlFromDatabase.Title = shareUrl.Title;
            shareUrlFromDatabase.Description = shareUrl.Description;
            await _repository.Update(shareUrlFromDatabase);
            return Ok(shareUrlFromDatabase);
        }

        // Delete delete/urls/abc
        /// <summary>
        /// Deletes the shared route.
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        [Authorize]
        [HttpDelete]
        [Route("{id}")]
        public async Task<IActionResult> DeleteShareUrl(string id)
        {
            var shareUrlFromDatabase = await _repository.GetUrlById(id);
            if (shareUrlFromDatabase == null)
            {
                return NotFound();
            }
            if (shareUrlFromDatabase.OsmUserId != User.Identity.Name)
            {
                return BadRequest("You can't delete someone else's share!");
            }
            await _repository.Delete(shareUrlFromDatabase);
            return Ok();
        }

        private static string GetRandomString(int length, Random random)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            return new string(Enumerable.Repeat(chars, length).Select(s => s[random.Next(s.Length)]).ToArray());
        }
    }
}
