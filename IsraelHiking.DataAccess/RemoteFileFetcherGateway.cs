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
                var response = await client.GetAsync(url);
                var fileName = (response.Content.Headers.ContentDisposition != null)
                    ? response.Content.Headers.ContentDisposition.FileName.Trim('"')
                    : url.Substring(url.LastIndexOf("/") + 1);
                var content = await response.Content.ReadAsByteArrayAsync();
                _logger.Debug("File was retrieved successfully from: " + url);
                return new RemoteFileFetcherGatewayResponse
                {
                    Content = content,
                    FileName = fileName,
                };
            }
        }
    }
}
