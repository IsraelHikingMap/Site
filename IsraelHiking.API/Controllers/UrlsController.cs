using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Http;

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

        // GET api/Urls/abc
        [Authorize]
        public async Task<IHttpActionResult> GetSiteUrlForUser()
        {
            var siteUrls = await _repository.GetUrlsByUser(User.Identity.Name);
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
        [Authorize]
        public async Task<IHttpActionResult> PutSiteUrl(string id, SiteUrl siteUrl)
        {
            var siteUrlFromDatabase = await _repository.GetUrlById(id);
            if (siteUrlFromDatabase == null)
            {
                return NotFound();
            }
            if (siteUrlFromDatabase.OsmUserId != User.Identity.Name)
            {
                return BadRequest("You can't update someone else's share!");
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
        [Authorize]
        public async Task<IHttpActionResult> DeleteSiteUrl(string id)
        {
            var siteUrlFromDatabase = await _repository.GetUrlById(id);
            if (siteUrlFromDatabase == null)
            {
                return NotFound();
            }
            if (siteUrlFromDatabase.OsmUserId != User.Identity.Name)
            {
                return BadRequest("You can't delete someone else's share!");
            }
            await _repository.Delete(siteUrlFromDatabase);
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
