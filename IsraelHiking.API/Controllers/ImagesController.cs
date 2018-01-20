using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using System.Collections.Generic;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Controllers
{
    /// <inheritdoc />
    /// <summary>
    /// This controller is responsible for image creation
    /// </summary>
    [Route("api/[controller]")]
    public class ImagesController : Controller
    {
        private readonly IImageCreationService _imageCreationService;
        private readonly IImgurGateway _imgurGateway;
        private readonly IRepository _repository;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        /// <param name="imageCreationService"></param>
        /// <param name="imgurGateway"></param>
        /// <param name="options"></param>
        public ImagesController(IRepository repository,
            IImageCreationService imageCreationService,
            IImgurGateway imgurGateway,
            IOptions<ConfigurationData> options)
        {
            _repository = repository;
            _imageCreationService = imageCreationService;
            _imgurGateway = imgurGateway;
            _options = options.Value;
        }

        /// <summary>
        /// Creates an image for the relevant shared route in the database
        /// </summary>
        /// <param name="id">The share route ID</param>
        /// <param name="width">Optional - the width of the image</param>
        /// <param name="height">Optional - the height of the image</param>
        /// <returns>An image</returns>
        [HttpGet]
        [Route("{id}")]
        public async Task<IActionResult> GetImage(string id, [FromQuery] int? width = null, [FromQuery] int? height = null)
        {
            var url = await _repository.GetUrlById(id);
            if (url == null)
            {
                return NotFound();
            }
            var imageData = await _imageCreationService.Create(url.DataContainer, width ?? 600, height ?? 315);
            return new FileContentResult(imageData, new MediaTypeHeaderValue("image/png"));
        }

        /// <summary>
        /// Get available route colors defined in the configurations
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [Route("colors")]
        public List<string> GetColors()
        {
            return _options.Colors;
        }

        /// <summary>
        /// When sending a <see cref="DataContainer"/> you'll recieve the image preview
        /// </summary>
        /// <param name="dataContainer"></param>
        /// <returns></returns>
        [HttpPost]
        [Route("")]
        public async Task<IActionResult> PostDataContainer([FromBody]DataContainer dataContainer)
        {
            var imageData = await _imageCreationService.Create(dataContainer, 600, 315);
            return new FileContentResult(imageData, new MediaTypeHeaderValue("image/png"));
        }

        /// <summary>
        /// Allows uploading of anonymous images
        /// </summary>
        /// <param name="file">The image file ot upload</param>
        /// <returns>A link to the image stored on the web</returns>
        [HttpPost]
        [Route("anonymous")]
        public async Task<string> PostUploadImage([FromForm]IFormFile file)
        {
            using (var stream = file.OpenReadStream())
            {
                var link = await _imgurGateway.UploadImage(stream);
                return link;
            }
        }
    }
}
