using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;
//using IsraelHiking.API.Services;
//using Newtonsoft.Json;

namespace IsraelHiking.API.Controllers
{
    public class UrlsController : ApiController
    {
        private IIsraelHikingRepository _repository;

        public UrlsController(IIsraelHikingRepository repository)
        {
            _repository = repository;
        }

        // GET api/Urls/abc
        public async Task<IHttpActionResult> GetSiteUrl(string id)
        {
            var siteUrl = await _repository.GetUrlById(id);
            if (siteUrl == null)
            {
                return BadRequest();
            }
            siteUrl.LastViewed = DateTime.Now;
            siteUrl.ViewsCount++;
            await _repository.Update(siteUrl);
            return Ok(siteUrl);
        }

        // GET api/UserUrls/abc
        [Route("api/userurls/{id}")]
        public async Task<IHttpActionResult> GetSiteUrlForUser(string id)
        {
            var siteUrls = await _repository.GetUrlsByUser(id);
            return Ok(siteUrls);
        }

        // POST api/urls
        public async Task<IHttpActionResult> PostSiteUrl(SiteUrl siteUrl)
        {
            var random = new Random(Guid.NewGuid().GetHashCode());
            siteUrl.CreationDate = DateTime.Now;
            siteUrl.LastViewed = DateTime.Now;
            siteUrl.ViewsCount = 0;
            var id = GetRandomString(10, random);
            while (await _repository.GetUrlById(id) != null)
            {
                id = GetRandomString(10, random);
            }
            siteUrl.Id = id;
            await _repository.AddUrl(siteUrl);
            return Ok(siteUrl);
        }

        // PUT api/urls/42
        public async Task<IHttpActionResult> PutSiteUrl(string id, SiteUrl siteUrl)
        {
            var siteUrlFromDatabase = await _repository.GetUrlById(id);
            if (siteUrlFromDatabase == null)
            {
                return NotFound();
            }
            siteUrlFromDatabase.Title = siteUrl.Title;
            siteUrlFromDatabase.Description = siteUrl.Description;
            await _repository.Update(siteUrlFromDatabase);
            return Ok(siteUrlFromDatabase);
        }

        // Delete delete/urls/abc
        /// <summary>
        /// Removes the user from the url, leaves it as public.
        /// </summary>
        /// <param name="id"></param>
        /// <returns></returns>
        public async Task<IHttpActionResult> DeleteSiteUrl(string id)
        {
            var siteUrlFromDatabase = await _repository.GetUrlById(id);
            if (siteUrlFromDatabase == null)
            {
                return NotFound();
            }
            siteUrlFromDatabase.OsmUserId = string.Empty;
            await _repository.Update(siteUrlFromDatabase);
            return Ok();
        }

        private static string GetRandomString(int length, Random random)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            return new string(Enumerable.Repeat(chars, length).Select(s => s[random.Next(s.Length)]).ToArray());
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                _repository.Dispose();
                _repository = null;
            }

            base.Dispose(disposing);
        }
    }
}
