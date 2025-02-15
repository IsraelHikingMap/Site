using NetTopologySuite.Features;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace IsraelHiking.DataAccessInterfaces;

public interface IINatureGateway : IInitializable
{
    Task<List<IFeature>> GetAll();

    Task<List<IFeature>> GetUpdates(DateTime lastUpdated);


}