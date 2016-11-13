using System;
using System.Net;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class RemoteFileFetcherGateway : IRemoteFileFetcherGateway
    {
        private readonly ILogger _logger;

        public RemoteFileFetcherGateway(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<long> GetFileSize(string url)
        {
            var httpWebRequest = (HttpWebRequest)WebRequest.Create(url);
            httpWebRequest.Method = "HEAD";
            var resp = (HttpWebResponse)await httpWebRequest.GetResponseAsync();
            return resp.ContentLength;
        }

        public async Task<RemoteFileFetcherGatewayResponse> GetFileContent(string url)
        {
            using (HttpClient client = new HttpClient())
            {
                _logger.Debug("Getting file from: " + url);
                client.Timeout = TimeSpan.FromMinutes(10);
                var response = await client.GetAsync(url);
                var fileName = response.Content.Headers.ContentDisposition?.FileName.Trim('"') ?? 
                    url.Substring(url.LastIndexOf("/", StringComparison.Ordinal) + 1);
                var content = new byte[0];
                if (response.IsSuccessStatusCode)
                {
                    content = await response.Content.ReadAsByteArrayAsync();
                    _logger.Debug("File was retrieved successfully from: " + url);
                }
                else
                {
                    _logger.Debug("Unable to retrieve file from: " + url + ", Status code: " + response.StatusCode);
                }
                
                return new RemoteFileFetcherGatewayResponse
                {
                    Content = content,
                    FileName = fileName
                };
            }
        }
    }
}
