using IsraelHiking.API.Executors;
using IsraelHiking.Common.Poi;
using Microsoft.AspNetCore.Mvc;
using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller facilitates for conversion between WGS84 coordinates to ITM coordinates
    /// The client doesn't use it, but I'm keeping it for external usage if anyone needs this
    /// </summary>
    [Route("api/[controller]")]
    public class ItmGridController : ControllerBase
    {
        private readonly MathTransform _wgs84ItmMathTransform;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="itmWgs84MathTransformFactory"></param>
        public ItmGridController(IItmWgs84MathTransfromFactory itmWgs84MathTransformFactory)
        {
            _wgs84ItmMathTransform = itmWgs84MathTransformFactory.CreateInverse();
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
            var coordinate = _wgs84ItmMathTransform.Transform(lon, lat);
            return new NorthEast { East = (int)coordinate.x, North = (int)coordinate.y };
        }
    }
}