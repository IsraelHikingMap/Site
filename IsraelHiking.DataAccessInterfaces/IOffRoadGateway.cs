using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IOffRoadGateway
    {
        Task<List<Feature>> GetAll();
        Task<FeatureCollection> GetById(string id);
    }
}