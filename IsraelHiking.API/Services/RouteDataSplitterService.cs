using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelTransverseMercator;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public class RouteDataSplitterService : IRouteDataSplitterService
    {
        private const int MAX_SEGMENTS_NUMBER = 40; // points
        private const int MINIMAL_TOLERANCE = 50; // meters
        private const int MINIMAL_SEGMENT_LENGTH = 500; // meters

        private readonly ICoordinatesConverter _coordinatesConverter;
        private readonly IDouglasPeuckerReductionService _douglasPeuckerReductionService;

        public RouteDataSplitterService(ICoordinatesConverter coordinatesConverter, 
            IDouglasPeuckerReductionService douglasPeuckerReductionService)
        {
            _coordinatesConverter = coordinatesConverter;
            _douglasPeuckerReductionService = douglasPeuckerReductionService;
        }

        public RouteData Split(RouteData routeData, string routingType)
        {
            var allRoutePoints = routeData.segments.SelectMany(s => s.latlngzs).ToList();
            var lineString = ToWgs84LineString(allRoutePoints);
            int maximumPoints = Math.Max(3, Math.Min((int)(lineString.Length / MINIMAL_SEGMENT_LENGTH), MAX_SEGMENTS_NUMBER));
            var currentTolerance = MINIMAL_TOLERANCE;
            List<int> simplifiedRouteIndexes;
            do
            {
                simplifiedRouteIndexes = _douglasPeuckerReductionService.GetSimplifiedRouteIndexes(lineString.Coordinates, currentTolerance);
                currentTolerance *= 2;
            } while (simplifiedRouteIndexes.Count > maximumPoints);

            var manipulatedRouteData = new RouteData
            {
                segments = new List<RouteSegmentData> { new RouteSegmentData
                    {
                        routePoint = allRoutePoints.First(),
                        latlngzs = new List<LatLngZ> { allRoutePoints.First(), allRoutePoints.First() }
                    } },
                name = routeData.name
            };

            for (int index = 1; index < simplifiedRouteIndexes.Count; index++)
            {
                var currentIndex = simplifiedRouteIndexes[index];
                var previousIndex = simplifiedRouteIndexes[index - 1];
                var latLngz = allRoutePoints.Skip(previousIndex).Take(currentIndex - previousIndex + 1).ToList();
                manipulatedRouteData.segments.Add(new RouteSegmentData
                {
                    latlngzs = latLngz,
                    routePoint = latLngz.Last(),
                    routingType = routingType
                });
            }

            return manipulatedRouteData;
        }

        private LineString ToWgs84LineString(IEnumerable<LatLng> latLngs)
        {
            var coordinates = latLngs.Select(latLng =>
            {
                var northEast = _coordinatesConverter.Wgs84ToItm(new LatLon { Longitude = latLng.lng, Latitude = latLng.lat });
                return new Coordinate(northEast.East, northEast.North);
            }).ToArray();
            return new LineString(coordinates);
        }
    }
}
