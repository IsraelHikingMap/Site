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

public class QonversionIdentityResponse
{
    [JsonPropertyName("id")]
    public string ID { get; set; }
    [JsonPropertyName("user_id")]
    public string UserID { get; set; }
}

public class QonversionEntitlementsResponse
{
    [JsonPropertyName("data")]
    public List<QonversionEntitlement> Data { get; set; }
}

public class QonversionEntitlement
{
    [JsonPropertyName("active")]
    public bool Active { get; set; }
}

public class ReceiptValidationGateway(
        IHttpClientFactory httpClientFactory,
        IOptions<NonPublicConfigurationData> options,
        ILogger logger)
        : IReceiptValidationGateway
    {
        private const string IAPTIC_VALIDATOR_URL = "https://validator.iaptic.com/v3/customers/";
        private const string REVENUECAT_VALIDATOR_URL = "https://api.revenuecat.com/v2/projects/proj1b16c0fa/customers/";

        private const string QONVERSION_IDENTITY_URL = "https://api.qonversion.io/v3/identities/";
        private const string QONVERSION_ENTITLEMENTS_URL = "https://api.qonversion.io/v3/users/";

        private readonly NonPublicConfigurationData _options = options.Value;

        public async Task<bool> IsEntitled(string userId)
        {
            var tasks = Task.WhenAll(
            [
                IsEntitledFromIaptic(userId),
                IsEntitledFromRevenueCat(userId),
                IsEntitledFromQonversion(userId)
            ]);
            var response = await tasks;
            return response.Any(r => r);
        }

        private async Task<bool> IsEntitledFromIaptic(string userId)
        {
            var client = httpClientFactory.CreateClient();
            // Docs: https://www.iaptic.com/documentation/api/v3/#api-Customers-GetCustomerPurchases
            var response = await client.GetAsync(IAPTIC_VALIDATOR_URL + userId + "/purchases?appName=il.org.osm.israelhiking&apiKey=" + _options.FoveaApiKey);
            var responseStr = await response.Content.ReadAsStringAsync();
            if (response.StatusCode != HttpStatusCode.OK)
            {
                logger.LogError("There was a problem communicating with the receipt validation server, code: " + response.StatusCode + ", " + responseStr);
                return false;
            }
            var iapticResponse = JsonSerializer.Deserialize<IapticPurchaseResponse>(responseStr);
            var iapticEntitled = iapticResponse.Purchases.Values.Any(v => v.IsExpired == false);
            logger.LogInformation("Is entitled with Iaptic for user: " + userId + " is: " + iapticEntitled);
            return iapticEntitled;
        }

        private async Task<bool> IsEntitledFromRevenueCat(string userId)
        {
            var client = httpClientFactory.CreateClient();
            //https://api.revenuecat.com/v2/projects/proj1b16c0fa/customers/{userId}/active_entitlements
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.RevenueCatApiKey);
            var response = await client.GetAsync(REVENUECAT_VALIDATOR_URL + userId + "/active_entitlements");
            var responseStr = await response.Content.ReadAsStringAsync();
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                logger.LogInformation("Is entitled with Revenuecat for user: " + userId + " is: false");
                return false;
            }
            if (response.StatusCode != HttpStatusCode.OK)
            {
                logger.LogError("There was a problem communicating with the receipt validation server, code: "
                                    + response.StatusCode + ", " + responseStr);
                return false;
            }
            var revenueCatEntitled = JsonSerializer.Deserialize<RevenueCatEntitlementsResponse>(responseStr).Items.Any();
            logger.LogInformation("Is entitled with Revenuecat for user: " + userId + " is: " + revenueCatEntitled);
            return revenueCatEntitled;
        }

        private async Task<bool> IsEntitledFromQonversion(string userId)
        {
            var client = httpClientFactory.CreateClient();
            // Docs: https://qonversion.io/docs/api/#tag/Identities/operation/getIdentity
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.QonversionApiKey);
            var response = await client.GetAsync(QONVERSION_IDENTITY_URL + userId);
            var responseStr = await response.Content.ReadAsStringAsync();
            if (response.StatusCode == HttpStatusCode.NotFound)
            {
                logger.LogInformation("Is entitled with Qonversion for user: " + userId + " is: false");
                return false;
            }
            if (response.StatusCode != HttpStatusCode.OK)
            {
                logger.LogError("There was a problem communicating with the receipt validation server, code: " + response.StatusCode + ", " + responseStr);
                return false;
            }
            var identityResponse = JsonSerializer.Deserialize<QonversionIdentityResponse>(responseStr);

            response = await client.GetAsync(QONVERSION_ENTITLEMENTS_URL + identityResponse.UserID + "/entitlements");
            responseStr = await response.Content.ReadAsStringAsync();

            if (response.StatusCode != HttpStatusCode.OK)
            {
                logger.LogError("There was a problem communicating with the receipt validation server, code: " + response.StatusCode + ", " + responseStr);
                return false;
            }
            var entitlementsResponse = JsonSerializer.Deserialize<QonversionEntitlementsResponse>(responseStr);
            var hasEntitlements = entitlementsResponse.Data.Any(e => e.Active);
            return hasEntitlements;
        }
    }