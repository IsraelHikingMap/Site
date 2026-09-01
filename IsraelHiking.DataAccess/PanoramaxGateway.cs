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

class PanoramaxUploadSet
{
    [JsonPropertyName("id")]
    public string Id { get; set; }
}

class PanoramaxRejection
{
    [JsonPropertyName("reason")]
    public string Reason { get; set; }
    [JsonPropertyName("message")]
    public string Message { get; set; }
}

class PanoramaxUploadedFile
{
    [JsonPropertyName("picture_id")]
    public string PictureId { get; set; }
    [JsonPropertyName("rejected")]
    public PanoramaxRejection Rejected { get; set; }
}

/// <summary>
/// The result of sending a picture to an upload set - the id the instance gave it, or why it refused it
/// </summary>
record PanoramaxUploadResult(string PictureId, string Error);

/// <inheritdoc/>
public class PanoramaxGateway(IHttpClientFactory httpClientFactory,
    IOptions<ConfigurationData> options,
    IOptions<NonPublicConfigurationData> nonPublicOptions,
    ILogger logger) : IImageUploadGateway
{
    /// <inheritdoc/>
    /// <remarks>
    /// The position is always overridden with the location of the point of interest rather than kept from the
    /// picture's EXIF, since the picture documents the point of interest and not the place it was taken from.
    /// The capture time is taken from the picture's own EXIF, and only when the instance refuses the picture -
    /// a picture with no capture time of its own for example - it is sent once more using the upload time,
    /// so that a picture that carries no metadata is still accepted.
    /// </remarks>
    public async Task<UploadedImage> UploadImage(string fileName, string description, string author, Stream contentStream, Coordinate location)
    {
        logger.LogInformation($"Uploading an image to panoramax. File name: {fileName}, Location: {location.Y}, {location.X}");
        using var memoryStream = new MemoryStream();
        await contentStream.CopyToAsync(memoryStream);
        var content = memoryStream.ToArray();
        using var client = CreateClient();
        var uploadSetId = await CreateUploadSet(client, fileName);
        var result = await AddPictureToUploadSet(client, uploadSetId, fileName, description, author, content, location, null);
        if (result.PictureId == null)
        {
            logger.LogWarning($"Panoramax refused {fileName}: {result.Error}, sending it again with the upload time");
            result = await AddPictureToUploadSet(client, uploadSetId, fileName, description, author, content, location, DateTime.UtcNow);
        }
        await CompleteUploadSet(client, uploadSetId);
        if (result.PictureId == null)
        {
            throw new Exception($"Unable to upload {fileName} to panoramax: {result.Error}");
        }
        logger.LogInformation($"Finished uploading image successfully. FileName: {fileName}, picture id: {result.PictureId}");
        return new UploadedImage(result.PictureId, null);
    }

    private HttpClient CreateClient()
    {
        var client = httpClientFactory.CreateClient();
        client.BaseAddress = new Uri(options.Value.PanoramaxServerAddress);
        client.Timeout = new TimeSpan(0, 5, 0);
        client.DefaultRequestHeaders.UserAgent.ParseAdd(Branding.USER_AGENT);
        var token = nonPublicOptions.Value.PanoramaxToken;
        if (!string.IsNullOrWhiteSpace(token))
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return client;
    }

    /// <summary>
    /// Creates the upload set a picture is sent in, one per picture
    /// </summary>
    /// <remarks>
    /// Deduplication and splitting are both turned off: all the pictures of a point of interest share its
    /// position, which is exactly what an instance considers a duplicate, and a point of interest picture
    /// is a single picture and not a part of a sequence.
    /// </remarks>
    private async Task<string> CreateUploadSet(HttpClient client, string fileName)
    {
        var response = await client.PostAsJsonAsync("api/upload_sets", new
        {
            title = fileName,
            estimated_nb_files = 1,
            no_deduplication = true,
            no_split = true
        });
        response.EnsureSuccessStatusCode();
        var uploadSet = await response.Content.ReadFromJsonAsync<PanoramaxUploadSet>();
        return uploadSet.Id;
    }

    /// <summary>
    /// Sends a picture to an upload set, an instance answers with a bad request when it can not make sense of
    /// the picture's metadata and with a rejection when it does not want the picture itself
    /// </summary>
    private async Task<PanoramaxUploadResult> AddPictureToUploadSet(HttpClient client,
        string uploadSetId,
        string fileName,
        string description,
        string author,
        byte[] content,
        Coordinate location,
        DateTime? captureTime)
    {
        using var form = new MultipartFormDataContent();
        var pictureContent = new ByteArrayContent(content);
        pictureContent.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        form.Add(pictureContent, "file", Path.ChangeExtension(fileName, ".jpg"));
        form.Add(new StringContent(location.Y.ToString(CultureInfo.InvariantCulture)), "override_latitude");
        form.Add(new StringContent(location.X.ToString(CultureInfo.InvariantCulture)), "override_longitude");
        form.Add(new StringContent(author), "override_Exif.Image.Artist");
        form.Add(new StringContent(description), "override_Exif.Image.ImageDescription");
        if (captureTime.HasValue)
        {
            form.Add(new StringContent(captureTime.Value.ToString("o", CultureInfo.InvariantCulture)), "override_capture_time");
        }
        var response = await client.PostAsync($"api/upload_sets/{uploadSetId}/files", form);
        if (!response.IsSuccessStatusCode)
        {
            return new PanoramaxUploadResult(null, await response.Content.ReadAsStringAsync());
        }
        var uploadedFile = await response.Content.ReadFromJsonAsync<PanoramaxUploadedFile>();
        return uploadedFile.Rejected == null && !string.IsNullOrWhiteSpace(uploadedFile.PictureId)
            ? new PanoramaxUploadResult(uploadedFile.PictureId, null)
            : new PanoramaxUploadResult(null, $"{uploadedFile.Rejected?.Reason} - {uploadedFile.Rejected?.Message}");
    }

    private async Task CompleteUploadSet(HttpClient client, string uploadSetId)
    {
        var response = await client.PostAsync($"api/upload_sets/{uploadSetId}/complete", null);
        response.EnsureSuccessStatusCode();
    }
}
