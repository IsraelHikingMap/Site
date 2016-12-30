using IsraelTransverseMercator;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    /// <summary>
    /// This controller facilitates for conversion between WGS84 coordinates to ITM coordinates
    /// </summary>
    public class ItmGridController : ApiController
    {
        private readonly ICoordinatesConverter _coordinatesConverter;

        /// <summary>
        /// Controller's constructor
        /// </summary>
        /// <param name="coordinatesConverter"></param>
        public ItmGridController(ICoordinatesConverter coordinatesConverter)
        {
            _coordinatesConverter = coordinatesConverter;
        }

        /// <summary>
        /// Converts latitude longitude to ITM coordinates
        /// </summary>
        /// <param name="lat">Latitude coordinate</param>
        /// <param name="lon">Longitude coordinate</param>
        /// <returns>North-East value in ITM coordinates</returns>
        public NorthEast GetItmCoordinates(double lat, double lon)
        {
            return _coordinatesConverter.Wgs84ToItm(new LatLon{Latitude = lat,Longitude = lon});
        }

    }
}
