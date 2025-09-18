using System;
using System.Net;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;
using System.Text.Json.Serialization;
using System.Collections.Generic;
using System.Text.Json;
using System.Linq;

namespace IsraelHiking.DataAccess;

public class IapticPurchaseResponse
{
    [JsonPropertyName("purchases")]
    public Dictionary<string, IapticPurchase> Purchases { get; set; }
}

public class IapticPurchase
{
    [JsonPropertyName("isExpired")]
    public bool IsExpired { get; set; }
}

public class RevenueCatEntitlementsResponse
{
    [JsonPropertyName("items")]
    public List<object> Items { get; set; }
}

public class ReceiptValidationGateway(
    IHttpClientFactory httpClientFactory,
    IOptions<NonPublicConfigurationData> options,
    ILogger logger)
    : IReceiptValidationGateway
{
    private const string IAPTIC_VALIDATOR_URL = "https://validator.iaptic.com/v3/customers/";
    private const string REVENUECAT_VALIDATOR_URL = "https://api.revenuecat.com/v2/projects/proj877f8747/customers/";

    private readonly NonPublicConfigurationData _options = options.Value;

    public async Task<bool> IsEntitled(string userId)
    {
        var client = httpClientFactory.CreateClient();
        // Docs: https://www.iaptic.com/documentation/api/v3/#api-Customers-GetCustomerPurchases
        var response = await client.GetAsync(IAPTIC_VALIDATOR_URL + userId + "/purchases?appName=il.org.osm.israelhiking&apiKey=" + _options.FoveaApiKey);
        var responseStr = await response.Content.ReadAsStringAsync();
        if (response.StatusCode != HttpStatusCode.OK)
        {
            throw new Exception("There was a problem communicating with the receipt validation server, code: "
                                + response.StatusCode + ", " + responseStr);
        }
        var iapticResponse = JsonSerializer.Deserialize<IapticPurchaseResponse>(responseStr);
        var iapticEntitled = iapticResponse.Purchases.Values.Any(v => v.IsExpired == false);
        logger.LogInformation("Is entitled with Iaptic for user: " + userId + " is: " + iapticEntitled);
        if (iapticEntitled)
        {
            return true;
        }
        //https://api.revenuecat.com/v2/projects/proj877f8747/customers/1257210/active_entitlements
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.RevenueCatApiKey);
        response = await client.GetAsync(REVENUECAT_VALIDATOR_URL + userId + "/active_entitlements");
        responseStr = await response.Content.ReadAsStringAsync();
        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            logger.LogInformation("Is entitled with Revenuecat for user: " + userId + " is: false");
            return false;
        }
        if (response.StatusCode != HttpStatusCode.OK)
        {
            throw new Exception("There was a problem communicating with the receipt validation server, code: "
                                + response.StatusCode + ", " + responseStr);
        }
        var hasEntitlements = JsonSerializer.Deserialize<RevenueCatEntitlementsResponse>(responseStr).Items.Any();
        logger.LogInformation("Is entitled with Revenuecat for user: " + userId + " is: " + hasEntitlements);
        return hasEntitlements;
    }
}