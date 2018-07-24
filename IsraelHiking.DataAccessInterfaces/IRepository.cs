using IsraelHiking.Common;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IRepository
    {
        Task<List<ShareUrl>> GetUrls(int page);
        Task AddUrl(ShareUrl shareUrl);
        Task<ShareUrl> GetUrlById(string id);
        Task<List<ShareUrl>> GetUrlsByUser(string osmUserId);
        Task Delete(ShareUrl shareUrl);
        Task Update(ShareUrl obj);

        Task<List<MapLayerData>> GetUserLayers(string osmUserId);
        Task<MapLayerData> GetUserLayerById(string id);
        Task<MapLayerData> AddUserLayer(MapLayerData layerData);
        Task UpdateUserLayer(MapLayerData layerData);
        Task DeleteUserLayer(MapLayerData layerData);

        Task<Rating> GetRating(string id, string source);
        Task UpdateRating(Rating rating);
        Task DeleteRating(Rating rating);
    }
}