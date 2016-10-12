using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Newtonsoft.Json;

namespace IsraelHiking.API.Controllers
{
    public class ImagesController : ApiController
    {
        private readonly IIsraelHikingRepository _israelHikingRepository;
        private readonly IImageCreationService _imageCreationService;

        public ImagesController(IIsraelHikingRepository israelHikingRepository, 
            IImageCreationService imageCreationService)
        {
            _israelHikingRepository = israelHikingRepository;
            _imageCreationService = imageCreationService;
        }

        public async Task<IHttpActionResult> GetImage(string id)
        {
            var url = await _israelHikingRepository.GetUrlById(id);
            if (url == null)
            {
                return NotFound();
            }
            var imageData = await _imageCreationService.Create(JsonConvert.DeserializeObject<DataContainer>(url.JsonData));
            var response = new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StreamContent(new MemoryStream(imageData))
            };
            response.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png");
            return ResponseMessage(response);
        }
    }
}
