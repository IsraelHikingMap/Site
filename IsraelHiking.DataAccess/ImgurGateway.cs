using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.IO;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    // This is only partial in order to get what we need
    internal class ImgurData
    {
        [JsonPropertyName("link")]
        public string Link { get; set; }
    }
    
    // This is only partial in order to get what we need, see https://apidocs.imgur.com/
    internal class ImgurUploadResponse {
        [JsonPropertyName("data")]
        public ImgurData Data { get; set; }
    }
    
    public class ImgurGateway : IImgurGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger _logger;
        private readonly NonPublicConfigurationData _options;

        public ImgurGateway(IHttpClientFactory httpClientFactory, 
            IOptions<NonPublicConfigurationData> options, 
            ILogger logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _options = options.Value;
        }

        public async Task<string> UploadImage(Stream stream)
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("Authorization", $"Client-ID {_options.ImgurClientId}");
            var formData = new MultipartFormDataContent {{new StreamContent(stream), "image"}};
            var response  = await client.PostAsync("https://api.imgur.com/3/image", formData);
            var content = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                throw new Exception("Unable to upload an image to imgur: " + content);
            }
            var responseJson = JsonSerializer.Deserialize<ImgurUploadResponse>(content);
            var link = responseJson.Data.Link;
            _logger.LogInformation($"Imgur file uploaded successfully, link: {link}");
            return link;
        }
    }
}
