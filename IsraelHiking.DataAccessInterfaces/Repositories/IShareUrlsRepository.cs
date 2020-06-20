using IsraelHiking.Common;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories
{
    public interface IShareUrlsRepository
    {
        Task<List<ShareUrl>> GetUrls();
        Task AddUrl(ShareUrl shareUrl);
        Task<ShareUrl> GetUrlById(string id);
        Task<List<ShareUrl>> GetUrlsByUser(string osmUserId);
        Task Delete(ShareUrl shareUrl);
        Task Update(ShareUrl obj);
    }
}
