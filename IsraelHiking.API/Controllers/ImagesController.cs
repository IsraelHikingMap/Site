using System.Threading.Tasks;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using System.Collections.Generic;
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
        private IImageCreationService _imageCreationService;
        private readonly IRepository _repository;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="repository"></param>
        /// <param name="imageCreationService"></param>
        /// <param name="options"></param>
        public ImagesController(IRepository repository,
            IImageCreationService imageCreationService,
            IOptions<ConfigurationData> options)
        {
            _repository = repository;
            _imageCreationService = imageCreationService;
            _options = options.Value;
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
            var url = await _repository.GetUrlById(id);
            if (url == null)
            {
                return NotFound();
            }
            var imageData = await _imageCreationService.Create(url.DataContainer);
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

        /// <inheritdoc />
        /// <summary>
        /// Dispose method, following dispose pattern
        /// </summary>
        /// <param name="disposing"></param>
        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                if (_imageCreationService != null)
                {
                    _imageCreationService.Dispose();
                    _imageCreationService = null;
                }
            }
            base.Dispose(disposing);
        }
    }
}
