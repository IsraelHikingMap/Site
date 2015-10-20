using IsraelHiking.DataAccess.Database;
using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class ShortUrlController : ApiController
    {
        private IsraelHikingDbContext _dbContext;

        public ShortUrlController()
        {
            _dbContext = new IsraelHikingDbContext();
        }

        // GET s/abc
        [Route("s/{id}")]
        public IHttpActionResult GetShortUrl(string id)
        {
            var shortUrl = _dbContext.ShortUrls.FirstOrDefault(s => s.Id == id);
            if (shortUrl == null)
            {
                return BadRequest();
            }
            shortUrl.LastViewed = DateTime.Now;
            shortUrl.ViewsCount++;
            _dbContext.SaveChanges();
            var response = Request.CreateResponse(HttpStatusCode.Moved);
            response.Headers.Location = new Uri(shortUrl.FullUrl);
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
            while (_dbContext.ShortUrls.FirstOrDefault(s => s.Id == id) != null)
            {
                id = GetRandomString(10);
            }
            shortUrl.Id = id;
            _dbContext.ShortUrls.Add(shortUrl);
            _dbContext.SaveChanges();
            return Ok(shortUrl);
        }

        // PUT api/shorturl/abc
        public IHttpActionResult PutShortUrl(string id, ShortUrl shortUrl)
        {
            var shortUrlFromDatabase = _dbContext.ShortUrls.FirstOrDefault(s => s.ModifyKey == id);
            if (shortUrlFromDatabase == null)
            {
                return NotFound();
            }
            shortUrlFromDatabase.FullUrl = shortUrl.FullUrl;
            shortUrl.LastViewed = DateTime.Now;
            _dbContext.SaveChanges();
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
                _dbContext.Dispose();
                _dbContext = null;
            }

            base.Dispose(disposing);
        }
    }
}
