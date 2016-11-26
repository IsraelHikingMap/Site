using System;
using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using IsraelHiking.Common;
using IsraelTransverseMercator;
using NetTopologySuite.Geometries;
using OsmSharp;

namespace IsraelHiking.API.Services
{
    public class DouglasPeuckerReductionService : IDouglasPeuckerReductionService
    {
        public List<int> GetSimplifiedRouteIndexes(IReadOnlyList<Coordinate> points, double tolerance)
        {
            if (points.Count < 3)
            {
                return Range.Int32(0, points.Count).ToList();
            }

            int firstPointIndex = 0;
            int lastPointIndex = points.Count - 1;
            var pointIndexsToKeep = new List<int> {firstPointIndex, lastPointIndex};

            //The first and the last point cannot be the same
            while (points[firstPointIndex].Equals(points[lastPointIndex]) && lastPointIndex > firstPointIndex)
            {
                lastPointIndex--;
            }

            DouglasPeuckerReduction(points, firstPointIndex, lastPointIndex, tolerance, ref pointIndexsToKeep);
            pointIndexsToKeep.Sort();

            return pointIndexsToKeep;
        }

        private void DouglasPeuckerReduction(IReadOnlyList<Coordinate> points, int firstPointIndex, int lastPointIndex, double tolerance, ref List<int> pointIndexsToKeep)
        {
            double maxDistance = 0;
            int farthestPointIndex = 0;

            for (int index = firstPointIndex; index < lastPointIndex; index++)
            {
                double distance = new Point(points[index]).Distance(new LineString(new [] { points[firstPointIndex], points[lastPointIndex] }));
                if (distance > maxDistance)
                {
                    maxDistance = distance;
                    farthestPointIndex = index;
                }
            }

            if (maxDistance > tolerance && farthestPointIndex != 0)
            {
                //Add the largest point that exceeds the tolerance
                pointIndexsToKeep.Add(farthestPointIndex);

                DouglasPeuckerReduction(points, firstPointIndex, farthestPointIndex, tolerance, ref pointIndexsToKeep);
                DouglasPeuckerReduction(points, farthestPointIndex, lastPointIndex, tolerance, ref pointIndexsToKeep);
            }
        }
    }
}
