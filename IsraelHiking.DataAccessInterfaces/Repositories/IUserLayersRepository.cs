using IsraelHiking.Common;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces.Repositories;

public interface IUserLayersRepository
{
    Task<List<MapLayerData>> GetUserLayers(string osmUserId);
    Task<MapLayerData> GetUserLayerById(string id);
    Task<MapLayerData> AddUserLayer(MapLayerData layerData);
    Task UpdateUserLayer(MapLayerData layerData);
    Task DeleteUserLayer(MapLayerData layerData);
}