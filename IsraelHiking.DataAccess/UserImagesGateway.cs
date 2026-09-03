using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using System;
using System.Globalization;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using ILogger = Microsoft.Extensions.Logging.ILogger;

namespace IsraelHiking.DataAccess;

class UserImagesResponse
{
    [JsonPropertyName("url")]
    public string Url { get; set; }
}

/// <inheritdoc/>
/// <remarks>
/// Unlike the other image hosts, this one credits the picture to the user who sent it rather than to
/// an account of the site, so it is given the OSM access token of the request it serves instead of a
/// token from the configuration.
/// </remarks>
public class UserImagesGateway(IHttpClientFactory httpClientFactory,
    IOsmAccessTokenProvider osmAccessTokenProvider,
    IOptions<ConfigurationData> options,
    ILogger logger) : IImageUploadGateway
{
    /// <inheritdoc/>
    public async Task<string> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location)
    {
        logger.LogInformation($"Uploading an image to user-images. File name: {fileName}, Location: {location.Y}, {location.X}");
        using var client = CreateClient();
        using var form = new MultipartFormDataContent();
        var pictureContent = new StreamContent(contentStream);
        pictureContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(pictureContent, "file", fileName);
        form.Add(new StringContent(description), "description");
        form.Add(new StringContent(location.Y.ToString(CultureInfo.InvariantCulture)), "lat");
        form.Add(new StringContent(location.X.ToString(CultureInfo.InvariantCulture)), "lng");

        var response = await client.PostAsync("api/images", form);
        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"Unable to upload {fileName} to user-images: {await response.Content.ReadAsStringAsync()}");
        }
        var uploaded = await response.Content.ReadFromJsonAsync<UserImagesResponse>();
        logger.LogInformation($"Finished uploading image successfully. FileName: {fileName}, url: {uploaded.Url}");
        return uploaded.Url;
    }

    /// <summary>
    /// Creates a client that uploads as the user of the current request, so that the image is credited
    /// to whoever took it and can be managed by them later
    /// </summary>
    private HttpClient CreateClient()
    {
        var client = httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(options.Value.UserImagesServerAddress);
        client.Timeout = new TimeSpan(0, 5, 0);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        var token = osmAccessTokenProvider.GetToken();
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new Exception("Unable to upload an image without the OSM token of the user");
        }
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }
}
