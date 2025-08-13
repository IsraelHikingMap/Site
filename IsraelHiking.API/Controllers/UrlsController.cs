using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Api;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using IsraelHiking.DataAccessInterfaces.Repositories;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Microsoft.Net.Http.Headers;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace IsraelHiking.API.Controllers;

/// <summary>
/// Does not require authorization, but authorization can be used,
/// this is a special case for creating a share url without a user.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public class OptionalAuthorizationAttribute : Attribute { }
    
    
/// <inheritdoc />
/// <summary>
/// This controller handles the shared routes
/// </summary>
[Route("api/[controller]")]
public class UrlsController : ControllerBase
{
    private readonly IShareUrlsRepository _repository;
    private readonly IDataContainerConverterService _dataContainerConverterService;
    private readonly IBase64ImageStringToFileConverter _base64ImageConverter;
    private readonly IImgurGateway _imgurGateway;
    private readonly IImageCreationGateway _imageCreationGateway;
    private readonly ILogger _logger;

    /// <summary>
    /// Controller's constructor
    /// </summary>
    /// <param name="repository"></param>
    /// <param name="dataContainerConverterService"></param>
    /// <param name="base64ImageConverter"></param>
    /// <param name="imgurGateway"></param>
    /// <param name="imageCreationGateway"></param>
    /// <param name="logger"></param>
    public UrlsController(IShareUrlsRepository repository,
        IDataContainerConverterService dataContainerConverterService,
        IBase64ImageStringToFileConverter base64ImageConverter,
        IImgurGateway imgurGateway,
        IImageCreationGateway imageCreationGateway,
        ILogger logger)
    {
        _repository = repository;
        _dataContainerConverterService = dataContainerConverterService;
        _base64ImageConverter = base64ImageConverter;
        _imgurGateway = imgurGateway;
        _logger = logger;
        _imageCreationGateway = imageCreationGateway;
    }

    /// <summary>
    /// Returns the data relevant to a given shared route
    /// </summary>
    /// <param name="id">The shared route ID</param>
    /// <param name="format">The format to convert to, default is <see cref="DataContainerPoco"/>, but you can use "gpx", "csv" and all other formats that can be opened in this site</param>
    /// <returns>The shared route in the requested format</returns>
    // GET api/Urls/abc?format=gpx
    [HttpGet]
    [Route("{id}")]
    public async Task<IActionResult> GetShareUrl(string id, string format = "")
    {
        var shareUrl = await _repository.GetUrlById(id);
        if (shareUrl == null)
        {
            return BadRequest();
        }
        shareUrl.LastViewed = DateTime.Now;
        shareUrl.ViewsCount++;
        shareUrl.FixModifiedDate();
        await _repository.Update(shareUrl);
        if (string.IsNullOrWhiteSpace(format))
        {
            return Ok(shareUrl);
        }
        return await GetUrlAsFile(id, format, shareUrl);
    }

    /// <summary>
    /// Returns the last modified timestamp relevant to a given shared route
    /// </summary>
    /// <param name="id">The shared route ID</param>
    /// <returns>The shared last modified timestamp</returns>
    // GET api/Urls/abc/timestamp
    [HttpGet]
    [Route("{id}/timestamp")]
    public async Task<DateTime> GetShareUrlLastModifiedTimeStamp(string id)
    {
        return await _repository.GetUrlTimestampById(id);
    }
    
    /// <summary>
    /// Creates an image for the relevant shared route in the database if the image was not created
    /// </summary>
    /// <param name="id">The share route ID</param>
    /// <param name="width">Optional - the width of the image</param>
    /// <param name="height">Optional - the height of the image</param>
    /// <returns>An image</returns>
    [HttpGet]
    [Route("{id}/thumbnail")]
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

    private async Task<IActionResult> GetUrlAsFile(string id, string format, ShareUrl shareUrl)
    {
        var bytes = await _dataContainerConverterService.ToAnyFormat(shareUrl.DataContainer, format);
        var restuls = new FileContentResult(bytes, new MediaTypeHeaderValue($"application/{format}"))
        {
            FileDownloadName = id + "." + format
        };
        return restuls;
    }

    /// <summary>
    /// Get all shared routes for a specific user
    /// </summary>
    /// <returns>The user's shared routes</returns>
    // GET api/Urls
    [Authorize]
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<ShareUrl>), 200)]
    public async Task<IActionResult> GetShareUrlForUser()
    {
        var shareUrls = await _repository.GetUrlsByUser(User.Identity!.Name);
        foreach (var shareUrl in shareUrls)
        {
            shareUrl.FixModifiedDate();
        }
        return Ok(shareUrls.OrderByDescending(d => d.LastModifiedDate));
    }

    /// <summary>
    /// Adds a shared route, user ID is optional
    /// </summary>
    /// <param name="shareUrl">The shared route's data</param>
    /// <returns>Whether the operation succeeded or not</returns>
    // POST api/urls
    [HttpPost]
    [OptionalAuthorization]
    [ProducesResponseType(typeof(ShareUrl), 200)]
    public async Task<IActionResult> PostShareUrl([FromBody]ShareUrl shareUrl)
    {
        if (shareUrl == null)
        {
            return BadRequest("Share object in body is required");
        }
        if (string.IsNullOrWhiteSpace(shareUrl.OsmUserId) == false && shareUrl.OsmUserId != User.Identity?.Name)
        {
            return BadRequest($"You can't create a share as someone else! {shareUrl.OsmUserId} != {User.Identity?.Name}");
        }
        var random = new Random(Guid.NewGuid().GetHashCode());
        var now = DateTime.Now;
        shareUrl.CreationDate = now;
        shareUrl.LastModifiedDate = now;
        shareUrl.LastViewed = now;
        shareUrl.ViewsCount = 0;
        var id = GetRandomString(10, random);
        while (await _repository.GetUrlById(id) != null)
        {
            id = GetRandomString(10, random);
        }
        shareUrl.Id = id;
        await _repository.AddUrl(shareUrl);

#pragma warning disable CS4014 // Because this call is not awaited, execution of the current method continues before the call is completed
        UploadImagesIfNeeded(shareUrl);
#pragma warning restore CS4014 // Because this call is not awaited, execution of the current method continues before the call is completed

        return Ok(shareUrl);
    }

    private Task UploadImagesIfNeeded(ShareUrl shareUrl)
    {
        var uploadTasks = new List<Task>();
        var links = shareUrl.DataContainer?.Routes.SelectMany(r => r.Markers.SelectMany(m => m.Urls));
        foreach (var link in links ?? new List<LinkData>())
        {
            var file = _base64ImageConverter.ConvertToFile(link.Url);
            if (file == null)
            {
                continue;
            }
            _logger.LogInformation($"Uploading image to imgur for share: {shareUrl.Id}");
            uploadTasks.Add(UploadToImgurAndUpdateLink(file, link));
        }

        return uploadTasks.Any()
            ? Task.WhenAll(uploadTasks).ContinueWith((t, a) => _repository.Update(shareUrl), null)
            : Task.CompletedTask;
    }

    private async Task UploadToImgurAndUpdateLink(RemoteFileFetcherGatewayResponse file, LinkData link)
    {
        using var memoryStream = new MemoryStream(file.Content);
        try
        {
            var newUrl = await _imgurGateway.UploadImage(memoryStream);
            link.Url = newUrl;
        }
        catch (Exception ex)
        {
            _logger.LogError($"Failed uploading image: {ex.Message}");
        }
    }

    /// <summary>
    /// Update a shared route
    /// </summary>
    /// <param name="id">The shared route's ID</param>
    /// <param name="shareUrl">The new shared route data</param>
    /// <returns>Whether the operation succeeded or not</returns>
    // PUT api/urls/42
    [Authorize]
    [HttpPut]
    [Route("{id}")]
    [ProducesResponseType(typeof(ShareUrl), 200)]
    public async Task<IActionResult> PutShareUrl(string id, [FromBody]ShareUrl shareUrl)
    {
        var shareUrlFromDatabase = await _repository.GetUrlById(id);
        if (shareUrlFromDatabase == null)
        {
            return NotFound();
        }
        if (shareUrlFromDatabase.OsmUserId != User.Identity.Name)
        {
            return BadRequest("You can't update someone else's share!");
        }
        shareUrlFromDatabase.Title = shareUrl.Title;
        shareUrlFromDatabase.Description = shareUrl.Description;
        shareUrlFromDatabase.LastModifiedDate = DateTime.Now;
        if (shareUrl.DataContainer != null)
        {
            // update can be made without the datacontainer data
            shareUrlFromDatabase.DataContainer = shareUrl.DataContainer;
        }
        if (!string.IsNullOrWhiteSpace(shareUrl.Base64Preview))
        {
            // update can be made without the image
            shareUrlFromDatabase.Base64Preview = shareUrl.Base64Preview;
        }
            
        await _repository.Update(shareUrlFromDatabase);
        return Ok(shareUrlFromDatabase);
    }

    // Delete delete/urls/abc
    /// <summary>
    /// Deletes the shared route.
    /// </summary>
    /// <param name="id"></param>
    /// <returns></returns>
    [Authorize]
    [HttpDelete]
    [Route("{id}")]
    public async Task<IActionResult> DeleteShareUrl(string id)
    {
        var shareUrlFromDatabase = await _repository.GetUrlById(id);
        if (shareUrlFromDatabase == null)
        {
            return NotFound();
        }
        if (shareUrlFromDatabase.OsmUserId != User.Identity.Name)
        {
            return BadRequest("You can't delete someone else's share!");
        }
        await _repository.Delete(shareUrlFromDatabase);
        return Ok();
    }

    private static string GetRandomString(int length, Random random)
    {
        const string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return new string(Enumerable.Repeat(chars, length).Select(s => s[random.Next(s.Length)]).ToArray());
    }
}