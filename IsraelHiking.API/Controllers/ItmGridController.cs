using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// Return value for elevation request
    /// </summary>
    public class NorthEast
    {
        /// <summary>
        /// North coordinates in meters
        /// </summary>
        public int North { get; set; }
        /// <summary>
        /// East coordinates in meters
        /// </summary>
        public int East { get; set; }
    }

    /// <summary>
    /// This controller facilitates for conversion between WGS84 coordinates to ITM coordinates
    /// </summary>
    [Route("api/[controller]")]
    public class ItmGridController : Controller
    {
        private readonly IMathTransform _wgs84ItmMathTransform;

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
            var coordiante = _wgs84ItmMathTransform.Transform(new Coordinate { Y = lat, X = lon });
            return new NorthEast { East = (int)coordiante.X, North = (int)coordiante.Y };
        }
    }
}