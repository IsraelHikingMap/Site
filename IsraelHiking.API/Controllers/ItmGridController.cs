using IsraelTransverseMercator;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class ItmGridController : ApiController
    {
        private readonly ICoordinatesConverter _coordinatesConverter;

        public ItmGridController(ICoordinatesConverter coordinatesConverter)
        {
            _coordinatesConverter = coordinatesConverter;
        }

        public NorthEast GetItmCoordinates(double lat, double lon)
        {
            return _coordinatesConverter.Wgs84ToItm(new LatLon{Latitude = lat,Longitude = lon});
        }

    }
}
