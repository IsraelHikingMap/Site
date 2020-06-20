using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces
{
    public interface IINatureGateway : IInitializable
    {
        Task<List<Feature>> GetAll();

        Task<List<Feature>> GetUpdates(DateTime lastUpdated);


    }
}
