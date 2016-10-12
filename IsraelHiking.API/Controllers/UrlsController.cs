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
        //private IImageCreationService _imageCreationService;

        public UrlsController(IIsraelHikingRepository repository
            //, IImageCreationService imageCreationService
            )
        {
            _repository = repository;
            //_imageCreationService = imageCreationService;
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
            var random = new Random(Guid.NewGuid().GetHashCode());
            siteUrl.CreationDate = DateTime.Now;
            siteUrl.LastViewed = DateTime.Now;
            siteUrl.ModifyKey = GetRandomString(10, random);
            siteUrl.ViewsCount = 0;
            var id = GetRandomString(10, random);
            while (await _repository.GetUrlById(id) != null)
            {
                id = GetRandomString(10, random);
            }
            siteUrl.Id = id;
            //siteUrl.Thumbnail = await _imageCreationService.Create(JsonConvert.DeserializeObject<DataContainer>(siteUrl.JsonData));
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
