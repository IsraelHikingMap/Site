using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess;

class UserDeviceRequest
{
    [JsonPropertyName("deviceId")]
    public string DeviceId { get; init; }
    [JsonPropertyName("platform")]
    public string Platform { get; init; }
    [JsonPropertyName("appVersion")]
    public string AppVersion { get; init; }
}

/// <inheritdoc/>
/// <remarks>
/// user-data owns the storage and stamps the times a device was first and last seen. It reads the user
/// from the OSM access token, which is also why the device is reported as the user of the request and
/// not as the site.
/// </remarks>
public class UserDevicesGateway(IHttpClientFactory httpClientFactory,
    IOsmAccessTokenProvider osmAccessTokenProvider,
    IOptions<ConfigurationData> options,
    ILogger logger) : IUserDevicesGateway
{
    /// <inheritdoc/>
    public async Task UpdateUserDevice(string deviceId, string platform, string appVersion)
    {
        try
        {
            using var client = httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", osmAccessTokenProvider.GetToken());
            var response = await client.PostAsJsonAsync(options.Value.UserDevicesApiAddress, new UserDeviceRequest
            {
                DeviceId = deviceId,
                Platform = platform,
                AppVersion = appVersion
            });
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Unable to update the device " + deviceId + ". Status code: " + response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Unable to update the device " + deviceId);
        }
    }
}
