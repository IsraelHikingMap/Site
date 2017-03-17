using IsraelHiking.DataAccessInterfaces;
using System.Linq;
using System.Threading.Tasks;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller allows elevation queries
    /// </summary>
    [Route("api/[controller]")]
    public class ElevationController : Controller
    {
        private readonly IElevationDataStorage _elevationDataStorage;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="elevationDataStorage"></param>
        public ElevationController(IElevationDataStorage elevationDataStorage)
        {
            _elevationDataStorage = elevationDataStorage;
        }

        /// <summary>
        /// Get elevation for the given points.
        /// </summary>
        /// <param name="points">The points array - each point should be latitude,longitude and use '|' to separate between points</param>
        /// <returns>An array of elevation values according to given points order</returns>
        [HttpGet]
        public async Task<double[]> GetElevation(string points)
        {
            var tasks = points.Split('|').Select(async p => await _elevationDataStorage.GetElevation(new Coordinate().FromLatLng(p)));
            return await Task.WhenAll(tasks);
        }
    }
}
