using System;
using System.Net;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess;

public class ReceiptValidationGateway : IReceiptValidationGateway
{
    private const string VALIDATOR_URL = "https://validator.iaptic.com/v3/customers/";

    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger _logger;
    private readonly NonPublicConfigurationData _options;

    public ReceiptValidationGateway(IHttpClientFactory httpClientFactory,
        IOptions<NonPublicConfigurationData> options,
        ILogger logger)
    {
        _httpClientFactory = httpClientFactory;
        _logger = logger;
        _options = options.Value;
    }

    public async Task<bool> IsEntitled(string userId)
    {
        var client = _httpClientFactory.CreateClient();
        // Docs: https://www.iaptic.com/documentation/api/v3/#api-Customers-GetCustomerPurchases
        var response = await client.GetAsync(VALIDATOR_URL + userId + "/purchases?appName=com.mapeak&apiKey=" + _options.FoveaApiKey);
        var responseStr = await response.Content.ReadAsStringAsync();
        if (response.StatusCode != HttpStatusCode.OK)
        {
            throw new Exception("There was a problem communicating with the receipt validation server, code: " 
                                + response.StatusCode + ", " + responseStr);
        }
        var returnValue = responseStr.Contains("\"isExpired\":false");
        _logger.LogInformation("Is entitled for user: " + userId + " is: " + returnValue);
        return returnValue;


    }
}