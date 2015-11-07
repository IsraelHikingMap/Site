using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class ShortUrlController : ApiController
    {
        private IIsraelHikingRepository _repository;

        public ShortUrlController(IIsraelHikingRepository repository)
        {
            _repository = repository;
        }

        // GET ShortUrl/abc
        public IHttpActionResult GetShortUrl(string id)
        {
            var shortUrl = _repository.GetShortUrlById(id);
            if (shortUrl == null)
            {
                return BadRequest();
            }
            shortUrl.LastViewed = DateTime.Now;
            shortUrl.ViewsCount++;
            _repository.Update(shortUrl);
            var response = Request.CreateResponse(HttpStatusCode.OK);
            response.Content = new StringContent(shortUrl.JsonData, Encoding.UTF8, "application/json");
            return ResponseMessage(response);
        }

        // POST api/shorturl
        public IHttpActionResult PostShortUrl(ShortUrl shortUrl)
        {
            shortUrl.CreationDate = DateTime.Now;
            shortUrl.LastViewed = DateTime.Now;
            shortUrl.ModifyKey = GetRandomString(10);
            shortUrl.ViewsCount = 0;
            var id = GetRandomString(10);
            while (_repository.GetShortUrlById(id) != null)
            {
                id = GetRandomString(10);
            }
            shortUrl.Id = id;
            _repository.AddShortUrl(shortUrl);
            return Ok(shortUrl);
        }

        // PUT api/shorturl/abc
        public IHttpActionResult PutShortUrl(string id, ShortUrl shortUrl)
        {
            var shortUrlFromDatabase = _repository.GetShortUrlByModifyKey(id);
            if (shortUrlFromDatabase == null)
            {
                return NotFound();
            }
            shortUrlFromDatabase.JsonData = shortUrl.JsonData;
            shortUrlFromDatabase.LastViewed = DateTime.Now;
            _repository.Update(shortUrlFromDatabase);
            return Ok(shortUrlFromDatabase);
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
