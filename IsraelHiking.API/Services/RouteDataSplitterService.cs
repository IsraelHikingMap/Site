using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;

namespace IsraelHiking.API.Services
{
    public class RouteDataSplitterService : IRouteDataSplitterService
    {
        private readonly IMathTransform _itmWgs84MathTransform;
        private readonly ConfigurationData _options;

        public RouteDataSplitterService(IMathTransform itmWgs84MathTransform, 
            IOptions<ConfigurationData> options)
        {
            _itmWgs84MathTransform = itmWgs84MathTransform;
            _options = options.Value;
        }

        public RouteData Split(RouteData routeData, string routingType)
        {
            var allRoutePoints = routeData.segments.SelectMany(s => s.latlngzs).ToList();
            var coordinates = ToWgs84Coordinates(allRoutePoints);
            int maximumPoints = Math.Max(3, Math.Min((int)(new LineString(coordinates).Length / _options.MinimalSegmentLength), _options.MaxSegmentsNumber));
            var currentTolerance = _options.MinimalSplitSimplificationTolerace;
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
            return latLngs.Select(latLng => _itmWgs84MathTransform.Inverse().Transform(new Coordinate { X = latLng.lng, Y = latLng.lat })).ToArray();
        }
    }
}
