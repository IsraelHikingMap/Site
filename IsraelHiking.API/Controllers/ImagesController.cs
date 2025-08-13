using System;
using IsraelHiking.Common;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;
using System.Threading.Tasks;
using IsraelHiking.API.Converters;

namespace IsraelHiking.API.Controllers;

/// <inheritdoc />
/// <summary>
/// This controller is responsible for image creation
/// </summary>
[Route("api/[controller]")]
[Obsolete("Should be removed at 12.2025")]
public class ImagesController : ControllerBase
{
    private readonly IImageCreationGateway _imageCreationGateway;
    private readonly IImgurGateway _imgurGateway;
    private readonly IShareUrlsRepository _repository;
    private readonly IBase64ImageStringToFileConverter _base64ImageConverter;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="repository"></param>
    /// <param name="imageCreationGateway"></param>
    /// <param name="imgurGateway"></param>
    /// <param name="base64ImageConverter"></param>
    public ImagesController(IShareUrlsRepository repository,
        IImageCreationGateway imageCreationGateway,
        IImgurGateway imgurGateway, 
        IBase64ImageStringToFileConverter base64ImageConverter)
    {
        _repository = repository;
        _imageCreationGateway = imageCreationGateway;
        _imgurGateway = imgurGateway;
        _base64ImageConverter = base64ImageConverter;
    }

    /// <summary>
    /// Given a location this method will create an image around it
    /// </summary>
    /// <param name="lat">latitude</param>
    /// <param name="lon">longitude</param>
    /// <param name="zoom">zoom</param>
    /// <param name="width">Image width in pixels</param>
    /// <param name="height">Image height in pixels</param>
    /// <param name="style">style name</param>
    /// <returns>An image</returns>
    [HttpGet]
    [Route("")]
    public async Task<IActionResult> GetImage(
        [FromQuery] double lat,
        [FromQuery] double lon,
        [FromQuery] int? zoom = null,
        [FromQuery] int? width = null,
        [FromQuery] int? height = null,
        [FromQuery] string style = ""
    )
    {
        var center = new LatLng(lat, lon);
        var distance = 0.001;
        var container = new DataContainerPoco
        {
            NorthEast = new LatLng(center.Lat + distance, center.Lng + distance),
            SouthWest = new LatLng(center.Lat - distance, center.Lng - distance),
            Overlays = [],
            BaseLayer = new LayerData
            {
                Address = style + ".json"
            },
            Routes =
            [
                new RouteData
                {
                    Markers = []
                }
            ]
        };
        var imageData = await _imageCreationGateway.Create(container, width ?? 512, height ?? 512);
        return new FileContentResult(imageData, new MediaTypeHeaderValue("image/png"));
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
    public async Task<IActionResult> GetImageForShare(string id, [FromQuery] int? width = null, [FromQuery] int? height = null)
    {
        var url = await _repository.GetUrlById(id);
        if (url == null)
        {
            return NotFound();
        }

        var imageData = string.IsNullOrWhiteSpace(url.Base64Preview)
            ? await _imageCreationGateway.Create(url.DataContainer, width ?? 600, height ?? 315)
            : _base64ImageConverter.ConvertToFile(url.Base64Preview).Content;
        return new FileContentResult(imageData, new MediaTypeHeaderValue("image/png"));
    }

    /// <summary>
    /// When sending a <see cref="DataContainerPoco"/> you'll recieve the image preview
    /// </summary>
    /// <param name="dataContainer"></param>
    /// <returns></returns>
    [HttpPost]
    [Route("")]
    public async Task<IActionResult> PostDataContainer([FromBody]DataContainerPoco dataContainer)
    {
        var imageData = await _imageCreationGateway.Create(dataContainer, 600, 315);
        return new FileContentResult(imageData, new MediaTypeHeaderValue("image/png"));
    }

    /// <summary>
    /// Allows uploading of anonymous images
    /// </summary>
    /// <param name="file">The image file ot upload</param>
    /// <returns>A link to the image stored on the web</returns>
    [HttpPost]
    [Route("anonymous")]
    public async Task<string> PostUploadImage(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        var link = await _imgurGateway.UploadImage(stream);
        return link;
    }
}