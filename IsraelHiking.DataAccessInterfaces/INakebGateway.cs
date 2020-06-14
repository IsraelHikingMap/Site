using NetTopologySuite.Features;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface INakebGateway
    {
        Task<List<Feature>> GetAll();

        Task<Feature> GetById(string id);
    }
}
