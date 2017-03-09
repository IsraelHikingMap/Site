using System;
using System.Net.Http;
using System.Threading.Tasks;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;

namespace IsraelHiking.DataAccess.Osm
{
    public abstract class BaseFileFetcherGateway : IRemoteFileFetcherGateway
    {
        private readonly ILogger _logger;

        protected BaseFileFetcherGateway(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url)
        {
            using (var client = new HttpClient())
            {
                _logger.LogDebug("Getting file from: " + url);
                UpdateHeaders(client, url);
                client.Timeout = TimeSpan.FromMinutes(10);
                var response = await client.GetAsync(url);
                var fileName = response.Content.Headers.ContentDisposition?.FileName.Trim('"') ??
                    url.Substring(url.LastIndexOf("/", StringComparison.Ordinal) + 1);
                var content = new byte[0];
                if (response.IsSuccessStatusCode)
                {
                    content = await response.Content.ReadAsByteArrayAsync();
                    _logger.LogDebug("File was retrieved successfully from: " + url);
                }
                else
                {
                    _logger.LogDebug("Unable to retrieve file from: " + url + ", Status code: " + response.StatusCode);
                }

                return new RemoteFileFetcherGatewayResponse
                {
                    Content = content,
                    FileName = fileName
                };
            }
        }

        protected virtual void UpdateHeaders(HttpClient client, string url, string method = "GET") { }
    }
}
