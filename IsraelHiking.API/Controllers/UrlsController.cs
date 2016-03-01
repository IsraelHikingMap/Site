using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
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

        // POST api/urls
        public async Task<IHttpActionResult> PostSiteUrl(SiteUrl siteUrl)
        {
            siteUrl.CreationDate = DateTime.Now;
            siteUrl.LastViewed = DateTime.Now;
            siteUrl.ModifyKey = GetRandomString(10);
            siteUrl.ViewsCount = 0;
            var id = GetRandomString(10);
            while (await _repository.GetUrlById(id) != null)
            {
                id = GetRandomString(10);
            }
            siteUrl.Id = id;
            await _repository.AddUrl(siteUrl);
            return Ok(siteUrl);
        }

        // PUT api/urls/abc
        public async Task<IHttpActionResult> PutSiteUrl(string id, SiteUrl siteUrl)
        {
            var siteUrlFromDatabase = await _repository.GetUrlByModifyKey(id);
            if (siteUrlFromDatabase == null)
            {
                return NotFound();
            }
            siteUrlFromDatabase.JsonData = siteUrl.JsonData;
            siteUrlFromDatabase.LastViewed = DateTime.Now;
            await _repository.Update(siteUrlFromDatabase);
            return Ok(siteUrlFromDatabase);
        }

        private static string GetRandomString(int length)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var random = new Random(DateTime.Now.Millisecond);
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
