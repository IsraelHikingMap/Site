using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;
using Microsoft.Extensions.Options;

namespace IsraelHiking.API.Services
{
    ///<inheritdoc/>
    public class RouteDataSplitterService : IRouteDataSplitterService
    {
        private readonly IMathTransform _itmWgs84MathTransform;
        private readonly ConfigurationData _options;

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="itmWgs84MathTransform"></param>
        /// <param name="options"></param>
        public RouteDataSplitterService(IMathTransform itmWgs84MathTransform, 
            IOptions<ConfigurationData> options)
        {
            _itmWgs84MathTransform = itmWgs84MathTransform;
            _options = options.Value;
        }

        ///<inheritdoc/>
        public RouteData Split(RouteData routeData, string routingType)
        {
            var allRoutePoints = routeData.segments.SelectMany(s => s.latlngs).ToList();
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
                        latlngs = new List<LatLng> { allRoutePoints.First(), allRoutePoints.First() }
                    } },
                name = routeData.name
            };

            for (int index = 1; index < simplifiedCoordinates.Length; index++)
            {
                var currentIndex = coordinates.ToList().IndexOf(simplifiedCoordinates[index]);
                coordinates = coordinates.Skip(currentIndex).ToArray();

                var latLngs = allRoutePoints.Take(currentIndex + 1).ToList();
                allRoutePoints = allRoutePoints.Skip(currentIndex).ToList();
                manipulatedRouteData.segments.Add(new RouteSegmentData
                {
                    latlngs = latLngs,
                    routePoint = latLngs.Last(),
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
