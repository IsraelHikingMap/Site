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
    /// <summary>
    /// This controller is responsible for image creation
    /// </summary>
    public class ImagesController : ApiController
    {
        private readonly IIsraelHikingRepository _israelHikingRepository;
        private readonly IImageCreationService _imageCreationService;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="israelHikingRepository"></param>
        /// <param name="imageCreationService"></param>
        public ImagesController(IIsraelHikingRepository israelHikingRepository, 
            IImageCreationService imageCreationService)
        {
            _israelHikingRepository = israelHikingRepository;
            _imageCreationService = imageCreationService;
        }

        /// <summary>
        /// Creates an image for the relevant shared route in the database
        /// </summary>
        /// <param name="id">The share route ID</param>
        /// <returns>An image</returns>
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
