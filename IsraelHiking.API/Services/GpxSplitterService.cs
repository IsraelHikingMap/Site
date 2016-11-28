using System.Collections.Generic;
using System.Linq;
using GeoAPI.Geometries;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Services
{
    public class GpxSplitterService : IGpxSplitterService
    {
        private const double CLOSEST_POINT_TOLERANCE = 30; // meters
        private const double MINIMAL_MISSING_PART_LENGTH = 200; // meters

        /// <summary>
        /// This algorithm works as follows:
        /// 1. Look for self loops in GPX file and split them into partial lines.
        /// 2. Look for close neighbour points and remove duplicate lines both from gpx lines and lines from input.
        /// </summary>
        /// <param name="gpxLines"></param>
        /// <param name="existingLineStrings"></param>
        /// <returns></returns>
        public List<LineString> Split(List<LineString> gpxLines, IReadOnlyList<LineString> existingLineStrings)
        {
            var gpxSplit = new List<LineString>();
            gpxLines = RemoveSelfLoop(gpxLines);
            foreach (var lineString in gpxLines)
            {
                var waypointsGroup = new List<Coordinate>();
                foreach (var coordinate in lineString.Coordinates)
                {
                    if (waypointsGroup.Count > 0 && waypointsGroup.Last().Equals(coordinate))
                    {
                        continue;
                    }
                    if (IsCloseToALine(coordinate, existingLineStrings.Concat(gpxSplit).ToArray()))
                    {
                        waypointsGroup.Add(coordinate);
                        AddLineString(gpxSplit, waypointsGroup.ToArray());
                        waypointsGroup = new List<Coordinate> {coordinate};
                        continue;
                    }
                    waypointsGroup.Add(coordinate);
                }
                AddLineString(gpxSplit, waypointsGroup.ToArray());
            }
            
            // return only lists with non-mapped lines that are long enough
            return gpxSplit.Where(l => l.Length > MINIMAL_MISSING_PART_LENGTH).ToList();
        }

        private List<LineString> RemoveSelfLoop(List<LineString> gpxSplit)
        {
            var lines = new List<LineString>();
            for (int gpxLineIndex = 0; gpxLineIndex < gpxSplit.Count; gpxLineIndex++)
            {
                for (int coordinateIndex = 0; coordinateIndex < gpxSplit[gpxLineIndex].Coordinates.Length; coordinateIndex++)
                {
                    var lineString = gpxSplit[gpxLineIndex];
                    var outSideRadius = false;
                    for (int nextCoordinateIndex = coordinateIndex + 1; nextCoordinateIndex < lineString.Coordinates.Length; nextCoordinateIndex++)
                    {
                        var nextCoordinate = lineString.Coordinates[nextCoordinateIndex];
                        var nextCoordinatePoint = new Point(nextCoordinate);
                        var distance = coordinateIndex > 1
                            ? nextCoordinatePoint.Distance(new LineString(lineString.Coordinates.Take(coordinateIndex + 1).ToArray()))
                            : nextCoordinatePoint.Distance(new Point(lineString.Coordinates[coordinateIndex]));
                        if (distance < CLOSEST_POINT_TOLERANCE)
                        {
                            if (outSideRadius == false)
                            {
                                continue;
                            }
                            AddLineString(gpxSplit, lineString.Coordinates.Skip(nextCoordinateIndex).ToArray());
                            gpxSplit[gpxLineIndex] = new LineString(lineString.Coordinates.Take(nextCoordinateIndex).ToArray());
                            break;
                        }
                        outSideRadius = true;
                    }
                }
                AddLineString(lines, gpxSplit[gpxLineIndex].Coordinates);
            }

            return lines;
        }

        private void AddLineString(ICollection<LineString> gpxSplit, Coordinate[] coordinates)
        {
            if (coordinates.Length < 3)
            {
                return;
            }
            var lineString = new LineString(coordinates);
            gpxSplit.Add(lineString);
        }

        private bool IsCloseToALine(Coordinate coordinate, IReadOnlyList<LineString> lineStrings)
        {
            var point = new Point(coordinate);
            if (!lineStrings.Any())
            {
                return false;
            }
            return lineStrings.Min(l => l.Distance(point)) < CLOSEST_POINT_TOLERANCE;
        }
    }
}