using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class ReceiptValidationGateway : IReceiptValidationGateway
    {
        private const string FOVEA_PURCHASES_API = "https://validator.fovea.cc/v2/customers/";

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
            // Docs: https://billing.fovea.cc/documentation/api/customer-purchases/
            var respone = await client.GetAsync(FOVEA_PURCHASES_API + userId + "/purchases?appName=il.org.osm.israelhiking&apiKey=" + _options.FoveaApiKey);
            var responseStr = await respone.Content.ReadAsStringAsync();
            var returnValue = responseStr.Contains("\"isExpired\":false");
            _logger.LogInformation("Is entitled for user: " + userId + " is: " + returnValue);
            return returnValue;


        }
    }
}
