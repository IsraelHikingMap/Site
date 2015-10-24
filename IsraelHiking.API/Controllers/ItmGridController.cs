using GeoJSON.Net.Geometry;
using IsraelTransverseMercator;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;

namespace IsraelHiking.API.Controllers
{
    public class ItmGridController : ApiController
    {
        public NorthEast GetItmCoordinates(double lat, double lon)
        {
            Converter converter = new Converter();
            var latLon = new LatLon
            {
                Latitude = lat,
                Longitude = lon,
            };
            return converter.Wgs84ToItm(latLon);
        }

    }
}
