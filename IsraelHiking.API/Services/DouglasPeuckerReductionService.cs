using System;
using System.Collections.Generic;
using System.Linq;
using IsraelHiking.Common;
using IsraelTransverseMercator;
using OsmSharp;

namespace IsraelHiking.API.Services
{
    public class DouglasPeuckerReductionService : IDouglasPeuckerReductionService
    {
        private const int MAX_SEGMENTS_NUMBER = 40; // points
        private const int MINIMAL_TOLERANCE = 50; // meters
        private const int MINIMAL_SEGMENT_LENGTH = 500; // meters

        private readonly ICoordinatesConverter _coordinatesConverter;

        public DouglasPeuckerReductionService(ICoordinatesConverter coordinatesConverter)
        {
            _coordinatesConverter = coordinatesConverter;
        }

        public RouteData SimplifyRouteData(RouteData routeData, string routingType)
        {
            var allRoutePoints = routeData.segments.SelectMany(s => s.latlngzs).ToList();
            double routeLength = allRoutePoints.Skip(1).Select((p, i) => GetDistance(p, allRoutePoints[i])).Sum();
            int maximumPoints = Math.Max(3, Math.Min((int)(routeLength / MINIMAL_SEGMENT_LENGTH), MAX_SEGMENTS_NUMBER));
            var currentTolerance = MINIMAL_TOLERANCE;
            List<int> indexes;
            do
            {
                indexes = DouglasPeuckerReduction(allRoutePoints.Select(llz => _coordinatesConverter.Wgs84ToItm(new LatLon { Latitude = llz.lat, Longitude = llz.lng })).ToList(), currentTolerance);
                currentTolerance *= 2;
            } while (indexes.Count > maximumPoints);

            var manipulatedRouteData = new RouteData
            {
                segments = new List<RouteSegmentData> { new RouteSegmentData
                    {
                        routePoint = new MarkerData() { latlng = allRoutePoints.First() },
                        latlngzs = new List<LatLngZ> { allRoutePoints.First(), allRoutePoints.First() }
                    } },
                name = routeData.name
            };

            for (int index = 1; index < indexes.Count; index++)
            {
                var currentIndex = indexes[index];
                var previousIndex = indexes[index - 1];
                var latLngz = allRoutePoints.Skip(previousIndex).Take(currentIndex - previousIndex + 1).ToList();
                manipulatedRouteData.segments.Add(new RouteSegmentData
                {
                    latlngzs = latLngz,
                    routePoint = new MarkerData { latlng = latLngz.Last() },
                    routingType = routingType
                });
            }

            return manipulatedRouteData;
        }

        private List<int> DouglasPeuckerReduction(IReadOnlyList<NorthEast> points, double tolerance)
        {
            if (points.Count < 3)
            {
                return Range.Int32(0, points.Count).ToList();
            }

            int firstPoint = 0;
            int lastPoint = points.Count - 1;
            var pointIndexsToKeep = new List<int> {firstPoint, lastPoint};

            //The first and the last point cannot be the same
            while (points[firstPoint].Equals(points[lastPoint]))
            {
                lastPoint--;
            }

            DouglasPeuckerReduction(points, firstPoint, lastPoint, tolerance, ref pointIndexsToKeep);
            pointIndexsToKeep.Sort();

            return pointIndexsToKeep;
        }

        private void DouglasPeuckerReduction(IReadOnlyList<NorthEast> points, int firstPoint, int lastPoint, double tolerance, ref List<int> pointIndexsToKeep)
        {
            double maxDistance = 0;
            int indexFarthest = 0;

            for (int index = firstPoint; index < lastPoint; index++)
            {
                double distance = PerpendicularDistance(points[firstPoint], points[lastPoint], points[index]);
                if (distance > maxDistance)
                {
                    maxDistance = distance;
                    indexFarthest = index;
                }
            }

            if (maxDistance > tolerance && indexFarthest != 0)
            {
                //Add the largest point that exceeds the tolerance
                pointIndexsToKeep.Add(indexFarthest);

                DouglasPeuckerReduction(points, firstPoint, indexFarthest, tolerance, ref pointIndexsToKeep);
                DouglasPeuckerReduction(points, indexFarthest, lastPoint, tolerance, ref pointIndexsToKeep);
            }
        }

        private double PerpendicularDistance(NorthEast point1, NorthEast point2, NorthEast point)
        {
            double area = Math.Abs(.5 * (point1.East * point2.North + point2.East * point.North + 
                point.East * point1.North - point2.East * point1.North - point.East * point2.North - point1.East * point.North));
            double bottom = Math.Sqrt(Math.Pow(point1.East - point2.East, 2) + Math.Pow(point1.North - point2.North, 2));
            double height = area / bottom * 2;

            return height;
        }

        private double GetDistance(LatLng point1, LatLng point2)
        {
            var northEast1 = _coordinatesConverter.Wgs84ToItm(new LatLon { Latitude = point1.lat, Longitude = point1.lng });
            var northEast2 = _coordinatesConverter.Wgs84ToItm(new LatLon { Latitude = point2.lat, Longitude = point2.lng });
            return Math.Sqrt(Math.Pow(northEast1.North - northEast2.North, 2) + Math.Pow(northEast1.East - northEast2.East, 2));
        }
    }
}
