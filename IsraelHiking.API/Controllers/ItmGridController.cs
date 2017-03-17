using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using Microsoft.AspNetCore.Mvc;

namespace IsraelHiking.API.Controllers
{
    public class NorthEast
    {
        public int North { get; set; }
        public int East { get; set; }
    }

    /// <summary>
    /// This controller facilitates for conversion between WGS84 coordinates to ITM coordinates
    /// </summary>
    [Route("api/[controller]")]
    public class ItmGridController : Controller
    {
        private readonly IMathTransform _itmWgs84MathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="itmWgs84MathTransform"></param>
        public ItmGridController(IMathTransform itmWgs84MathTransform)
        {
            _itmWgs84MathTransform = itmWgs84MathTransform;
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
            var coordiante = _itmWgs84MathTransform.Inverse().Transform(new Coordinate { Y = lat, X = lon });
            return new NorthEast { East = (int)coordiante.X, North = (int)coordiante.Y };
        }
    }
}