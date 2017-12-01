using IsraelHiking.Common;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRepository
    {
        Task AddUrl(ShareUrl shareUrl);
        Task<ShareUrl> GetUrlById(string id);
        Task<List<ShareUrl>> GetUrlsByUser(string osmUserId);
        Task Delete(ShareUrl shareUrl);
        Task Update(ShareUrl obj);

        Task<UserMapLayers> GetUserLayers(string osmUserId);
        Task UpdateUserLayers(string osmUserId, UserMapLayers userLayers);

        Task<Rating> GetRating(string id, string source);
        Task UpdateRating(Rating rating);
    }
}