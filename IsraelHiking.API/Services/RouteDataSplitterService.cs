using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelTransverseMercator;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;

namespace IsraelHiking.API.Services
{
    public class RouteDataSplitterService : IRouteDataSplitterService
    {
        private const int MAX_SEGMENTS_NUMBER = 40; // points
        private const int MINIMAL_TOLERANCE = 50; // meters
        private const int MINIMAL_SEGMENT_LENGTH = 500; // meters

        private readonly ICoordinatesConverter _coordinatesConverter;

        public RouteDataSplitterService(ICoordinatesConverter coordinatesConverter)
        {
            _coordinatesConverter = coordinatesConverter;
        }

        public RouteData Split(RouteData routeData, string routingType)
        {
            var allRoutePoints = routeData.segments.SelectMany(s => s.latlngzs).ToList();
            var coordinates = ToWgs84Coordinates(allRoutePoints);
            int maximumPoints = Math.Max(3, Math.Min((int)(new LineString(coordinates).Length / MINIMAL_SEGMENT_LENGTH), MAX_SEGMENTS_NUMBER));
            var currentTolerance = MINIMAL_TOLERANCE;
            Coordinate[] simplifiedCoordinates;
            do
            {
                simplifiedCoordinates = DouglasPeuckerLineSimplifier.Simplify(coordinates, currentTolerance);
                currentTolerance *= 2;
            } while (simplifiedCoordinates.Length > maximumPoints);

            var manipulatedRouteData = new RouteData
            {
                segments = new List<RouteSegmentData> { new RouteSegmentData
                    {
                        routePoint = allRoutePoints.First(),
                        latlngzs = new List<LatLngZ> { allRoutePoints.First(), allRoutePoints.First() }
                    } },
                name = routeData.name
            };

            for (int index = 1; index < simplifiedCoordinates.Length; index++)
            {
                var currentIndex = coordinates.ToList().IndexOf(simplifiedCoordinates[index]);
                coordinates = coordinates.Skip(currentIndex).ToArray();

                var latLngz = allRoutePoints.Take(currentIndex + 1).ToList();
                allRoutePoints = allRoutePoints.Skip(currentIndex).ToList();
                manipulatedRouteData.segments.Add(new RouteSegmentData
                {
                    latlngzs = latLngz,
                    routePoint = latLngz.Last(),
                    routingType = routingType
                });
            }

            return manipulatedRouteData;
        }

        private Coordinate[] ToWgs84Coordinates(IEnumerable<LatLng> latLngs)
        {
            return latLngs.Select(latLng =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = latLng.lng, Latitude = latLng.lat });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
        }
    }
}
