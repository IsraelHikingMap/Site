using System.Collections.Generic;
using System.Threading.Tasks;
using NetTopologySuite.Features;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface INakebGateway
    {
        Task<List<Feature>> GetAll();
        Task<FeatureCollection> GetById(int id);
    }
}