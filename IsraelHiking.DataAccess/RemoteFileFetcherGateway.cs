using System.Net;
using IsraelHiking.DataAccessInterfaces;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System;
using IsraelHiking.Common.Api;

namespace IsraelHiking.DataAccess
{
    public class RemoteFileFetcherGateway : IRemoteFileSizeFetcherGateway
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly ILogger _logger;

        public RemoteFileFetcherGateway(IHttpClientFactory httpClientFactory, ILogger logger)
        {
            _httpClientFactory = httpClientFactory;
            _logger = logger;
        }

        public async Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url)
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromMinutes(20);
            var response = await client.GetAsync(url);
            var fileName = response.Content.Headers.ContentDisposition?.FileName?.Trim('"') ??
                response.Content.Headers.ContentDisposition?.FileNameStar?.Trim('"') ??
                url.Substring(url.LastIndexOf("/", StringComparison.Ordinal) + 1);
            var content = new byte[0];
            if (response.IsSuccessStatusCode)
            {
                content = await response.Content.ReadAsByteArrayAsync();
            }
            else
            {
                _logger.LogError("Unable to retrieve file from: " + url + ", Status code: " + response.StatusCode);
            }

            return new RemoteFileFetcherGatewayResponse
            {
                Content = content,
                FileName = fileName
            };
        }
        public async Task<long> GetFileSize(string url)
        {
            var httpWebRequest = (HttpWebRequest)WebRequest.Create(url);
            httpWebRequest.Method = "HEAD";
            var resp = (HttpWebResponse)await httpWebRequest.GetResponseAsync();
            return resp.ContentLength;
        }
    }
}
