using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess
{
    public class GpsBabelGateway : IGpsBabelGateway
    {
        private readonly ILogger _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ConfigurationData _options;

        public GpsBabelGateway(ILogger logger,
            IHttpClientFactory httpClientFactory,
            IOptions<ConfigurationData> options)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
        }

        public async Task<byte[]> ConvertFileFromat(byte[] content, string inputFormat, string outputFormat)
        {
            if (inputFormat == outputFormat)
            {
                return content;
            }
            var client = _httpClientFactory.CreateClient();
            var formData = new MultipartFormDataContent();
            formData.Add(new ByteArrayContent(content), name: "file", fileName: "file");
            formData.Add(new StringContent(inputFormat), "inputFormat");
            formData.Add(new StringContent(outputFormat), "outputFormat");
            var response = await client.PostAsync(_options.GpsBabelServerAddress, formData);
            if (response.IsSuccessStatusCode)
            {
                _logger.LogInformation("Finished converting data from: " + inputFormat + " to: " + outputFormat);
            }
            else
            {
                _logger.LogError("Failed converting data from: " + inputFormat + " to: " + outputFormat);
            }
            return await response.Content.ReadAsByteArrayAsync();
        }
    }
}
