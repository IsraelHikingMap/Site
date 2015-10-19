using IsraelHiking.DataAccess.Database;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
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

        // GET api/shorturl?url=short
        public IHttpActionResult GetFullUrl(string url)
        {
            var shortUrl = _dbContext.ShortUrls.FirstOrDefault(s => s.Url == url);
            if (shortUrl == null)
            {
                return BadRequest();
            }
            shortUrl.LastViewed = DateTime.Now;
            _dbContext.SaveChanges();
            return Ok(shortUrl.FullUrl);
        }

        // POST api/shorturl?url=some-long-url
        public IHttpActionResult PostShortUrl(string url)
        {
            var shortUrl = new ShortUrl
            {
                CreationDate = DateTime.Now,
                LastViewed = DateTime.Now,
                FullUrl = url,
                ModifyKey = GetRandomString(10),
            };
            var shortUrlString = GetRandomString(8);
            while (_dbContext.ShortUrls.FirstOrDefault(s => s.Url == shortUrlString) != null)
            {
                shortUrlString = GetRandomString(8);
            }
            shortUrl.Url = shortUrlString;
            _dbContext.ShortUrls.Add(shortUrl);
            _dbContext.SaveChanges();
            return Ok(shortUrl);
        }

        // PUT api/shorturl?url=some-long-url&modifyKey=mykey
        public IHttpActionResult PutShortUrl(string url, string modifyKey)
        {
            var shortUrl = _dbContext.ShortUrls.FirstOrDefault(s => s.ModifyKey == modifyKey);
            if (shortUrl == null)
            {
                return NotFound();
            }
            shortUrl.FullUrl = url;
            _dbContext.SaveChanges();
            return Ok();
        }

        private static string GetRandomString(int length)
        {
            const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var random = new Random();
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
