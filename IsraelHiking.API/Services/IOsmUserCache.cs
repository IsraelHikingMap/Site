using System.Threading.Tasks;

namespace IsraelHiking.API.Services
{
    public interface IOsmUserCache
    {
        Task<string> GetUserId(string token, string tokenSecret);
        void TryGetTokenAndSecret(string userId, out string token, out string tokenSecret);
    }
}