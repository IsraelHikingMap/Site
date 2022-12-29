using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;

namespace IsraelHiking.DataAccess
{
    /// <inheritdoc />
    public class OsmLatestFileGateway : IOsmLatestFileGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger _logger;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="httpClientFactory"></param>
        /// <param name="logger"></param>
        public OsmLatestFileGateway(IOptions<ConfigurationData> options, 
            IHttpClientFactory httpClientFactory,
            ILogger logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
            _options = options.Value;
        }
        

        /// <inheritdoc />
        public async Task<Stream> Get()
        {
            // return await Task.FromResult(new MemoryStream(File.ReadAllBytes("/Users/harel/Downloads/israel-and-palestine-latest.osm.pbf")) as Stream);
            var client = _httpClientFactory.CreateClient();
            _logger.LogInformation($"Starting to fetch OSM file from {_options.OsmFileAddress}");
            client.Timeout = TimeSpan.FromMinutes(20);
            var response = await client.GetAsync(_options.OsmFileAddress);
            _logger.LogInformation($"Finished fetching OSM file from {_options.OsmFileAddress}");
            return await response.Content.ReadAsStreamAsync();
        }
    }
}
