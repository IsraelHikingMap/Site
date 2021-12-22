using System;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;

namespace IsraelHiking.DataAccess
{
    public class ImageCreationGateway : IImageCreationGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _serverAddress;
        
        public ImageCreationGateway(IHttpClientFactory httpClientFactory, IOptions<ConfigurationData> options)
        {
            _httpClientFactory = httpClientFactory;
            _serverAddress = options.Value.ImageCreatorServerAddress;
        }
        public async Task<byte[]> Create(DataContainerPoco dataContainer, int width, int height)
        {
            var client = _httpClientFactory.CreateClient();
            var response = await client.PostAsync(_serverAddress + $"?width={width}&height={height}", JsonContent.Create(dataContainer));
            return await response.Content.ReadAsByteArrayAsync();
        }
    }
}