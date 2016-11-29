using System.Net.Http;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOsmGateway
    {
        Task<HttpResponseMessage> Get(string url, string token, string tokenSecret);
    }
}