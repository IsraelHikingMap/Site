using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    internal class OsmCToolCreateRequest
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        [JsonProperty("fileName")]
        public string FileName { get; set; }
        [JsonProperty("updateFileName")]
        public string UpdateFileName { get; set; }
        [JsonProperty("osmDownloadAddress")]
        public string OsmDownloadAddress { get; set; }
        [JsonProperty("osmTimeStampAddress")]
        public string OsmTimeStampAddress { get; set; }
        [JsonProperty("baseUpdateAddress")]
        public string BaseUpdateAddress { get; set; }
        [JsonProperty("updateMode")]
        public string UpdateMode { get; set; }
    }

    internal class OsmCToolUpdateRequest
    {
        [JsonProperty("downloadFile")]
        public bool DownloadFile { get; set; }
        [JsonProperty("updateFile")]
        public bool UpdateFile { get; set; }
    }

    /// <inheritdoc />
    public class OsmLatestFileGateway : IOsmLatestFileGateway
    {
        private const string CONTAINER_ID = "IHM";

        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="logger"></param>
        public OsmLatestFileGateway(IOptions<ConfigurationData> options, 
            IHttpClientFactory httpClientFactory,
            ILogger logger)
        {
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
        }

        /// <inheritdoc />
        public async Task Update(bool downloadFile = true, bool updateFile = true)
        {
            _logger.LogInformation($"Starting updating OSM file. download: {downloadFile}, update: {updateFile}");
            await CheckIfExistsOrCreateContainer();

            var updateRequestBody = new StringContent(
                JsonConvert.SerializeObject(new OsmCToolUpdateRequest
                {
                    DownloadFile = downloadFile,
                    UpdateFile = updateFile
                }),
                Encoding.UTF8,
                "application/json"
            );
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(60);
            await client.PutAsync(_options.OsmCToolsServerAddress + CONTAINER_ID, updateRequestBody);
            _logger.LogInformation($"Finished updating OSM file. download: {downloadFile}, update: {updateFile}");

        }

        /// <inheritdoc />
        public async Task<Stream> Get()
        {
            await CheckIfExistsOrCreateContainer();
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(10);
            var response = await client.GetAsync(_options.OsmCToolsServerAddress + CONTAINER_ID);
            return await response.Content.ReadAsStreamAsync();
        }

        private async Task CheckIfExistsOrCreateContainer() {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(20);
            var getResponse = await client.GetAsync(_options.OsmCToolsServerAddress);
            var response = await getResponse.Content.ReadAsStringAsync();
            if (response.Contains(CONTAINER_ID)) {
                return;
            }
            _logger.LogInformation($"No pbf container. creating one...");
            var createRequestBody = new StringContent(
                JsonConvert.SerializeObject(new OsmCToolCreateRequest
                {
                    Id = CONTAINER_ID,
                    FileName = Sources.OSM_FILE_NAME,
                    UpdateFileName = Path.GetFileNameWithoutExtension(Sources.OSM_FILE_NAME) + ".osc",
                    BaseUpdateAddress = _options.OsmMinutsFileBaseAddress,
                    OsmDownloadAddress = _options.OsmFileAddress,
                    OsmTimeStampAddress = _options.OsmFileTimeStampAddress,
                    UpdateMode = "Minute"
                }),
                Encoding.UTF8,
                "application/json"
            );
            var createResponse = await client.PostAsync(_options.OsmCToolsServerAddress, createRequestBody);
            if (!createResponse.IsSuccessStatusCode)
            {
                _logger.LogError($"Failed creating pbf container");
                return;
            }
            _logger.LogInformation($"Finsiehd creating pbf container");
        }


        /// <inheritdoc />
        public async Task<Stream> GetUpdates()
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(60);
            var response = await client.PostAsync(_options.OsmCToolsServerAddress + CONTAINER_ID + "/updates", new StringContent(""));
            return await response.Content.ReadAsStreamAsync();
        }
   }
}
