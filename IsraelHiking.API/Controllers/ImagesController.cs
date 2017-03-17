using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller is responsible for image creation
    /// </summary>
    [Route("api/[controller]")]
    public class ImagesController : Controller
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
        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> GetImage(string id)
        {
            var url = await _israelHikingRepository.GetUrlById(id);
            if (url == null)
            {
                return NotFound();
            }
            var imageData = await _imageCreationService.Create(JsonConvert.DeserializeObject<DataContainer>(url.JsonData));
            return new FileContentResult(imageData, new MediaTypeHeaderValue("image/png"));
        }
    }
}
