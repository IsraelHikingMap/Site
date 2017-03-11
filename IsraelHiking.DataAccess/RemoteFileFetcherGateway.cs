using System.Net;
using IsraelHiking.DataAccessInterfaces;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccess
{
    public class RemoteFileFetcherGateway : BaseFileFetcherGateway, IRemoteFileSizeFetcherGateway
    {

        public RemoteFileFetcherGateway(ILogger logger): base(logger)
        {
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
