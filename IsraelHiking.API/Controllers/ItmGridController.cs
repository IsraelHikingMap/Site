using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.Common.Poi;
using Microsoft.AspNetCore.Mvc;
using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller facilitates for conversion between WGS84 coordinates to ITM coordinates
    /// </summary>
    [Route("api/[controller]")]
    public class ItmGridController : ControllerBase
    {
        private readonly MathTransform _wgs84ItmMathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="itmWgs84MathTransfromFactory"></param>
        public ItmGridController(IItmWgs84MathTransfromFactory itmWgs84MathTransfromFactory)
        {
            _wgs84ItmMathTransform = itmWgs84MathTransfromFactory.CreateInverse();
        }

        /// <summary>
        /// Converts latitude longitude to ITM coordinates
        /// </summary>
        /// <param name="lat">Latitude coordinate</param>
        /// <param name="lon">Longitude coordinate</param>
        /// <returns>North-East value in ITM coordinates</returns>
        // GET api/itmgrid?lat=123&lon=456
        [HttpGet]
        public NorthEast GetItmCoordinates(double lat, double lon)
        {
            var coordiante = _wgs84ItmMathTransform.Transform(new Coordinate(lon, lat));
            return new NorthEast { East = (int)coordiante.X, North = (int)coordiante.Y };
        }
    }
}