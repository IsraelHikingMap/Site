using IsraelHiking.DataAccessInterfaces;
using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class RemoveFileFetcherGateway : IRemoveFileFetcherGateway
    {
        private readonly ILogger _logger;

        public RemoveFileFetcherGateway(ILogger logger)
        {
            _logger = logger;
        }

        public async Task<byte[]> GetFileContent(string url)
        {
            using (HttpClient client = new HttpClient())
            {
                _logger.Debug("Getting file from: " + url);
                var response = await client.GetAsync(url);
                var content = await response.Content.ReadAsByteArrayAsync();
                _logger.Debug("File was retrieved successfully from: " + url);
                return content;
            }
        }
    }
}
