using IsraelHiking.Common.Api;
using System.Threading.Tasks;

namespace IsraelHiking.API.Services.Osm
{
    /// <summary>
    /// This service is responsible for updating the database with change made in OSM
    /// </summary>
    public interface IDatabasesUpdaterService
    {
        /// <summary>
        /// This method is responsible for rebuilding the database from the OSM pbf stream
        /// </summary>
        /// <param name="request"></param>
        /// <returns></returns>
        Task Rebuild(UpdateRequest request);
    }
}