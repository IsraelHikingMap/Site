using System;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services
{
    [Flags]
    public enum OsmDataServiceOperations
    {
        None = 0,
        GetOsmFile = 1,
        UpdateElasticSearch = 2,
        UpdateGraphHopper = 4,
        All = GetOsmFile | UpdateElasticSearch | UpdateGraphHopper
    }

    public interface IOsmDataService
    {
        Task Initialize(string serverPath);
        Task UpdateData(OsmDataServiceOperations operations);
    }
}