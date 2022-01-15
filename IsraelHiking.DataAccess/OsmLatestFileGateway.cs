﻿using IsraelHiking.Common.Configuration;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    /// <inheritdoc />
    public class OsmLatestFileGateway : IOsmLatestFileGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="options"></param>
        /// <param name="httpClientFactory"></param>
        public OsmLatestFileGateway(IOptions<ConfigurationData> options, 
            IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
            _options = options.Value;
        }
        

        /// <inheritdoc />
        public async Task<Stream> Get()
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(20);
            var response = await client.GetAsync(_options.OsmFileAddress);
            return await response.Content.ReadAsStreamAsync();
        }
    }
}
