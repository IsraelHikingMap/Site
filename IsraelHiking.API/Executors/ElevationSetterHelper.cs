using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This helper helps setting the z value of coordinate sequence
    /// </summary>
    public static class ElevationSetterHelper
    {
        private sealed class GetCoordinatesFilter : ICoordinateSequenceFilter
        {
            public Dictionary<int, Coordinate> CoordinatesMap { get; set; }
            
            public GetCoordinatesFilter() => CoordinatesMap = new();

            bool ICoordinateSequenceFilter.Done => false;
            bool ICoordinateSequenceFilter.GeometryChanged => false;

            public void Filter(CoordinateSequence seq, int i)
            {
                CoordinatesMap[i] = seq.GetCoordinate(i);
            }
        }
        
        private sealed class SetElevationValuesFilter : ICoordinateSequenceFilter
        {
            private readonly Dictionary<int, double> _elevationValue;

            public SetElevationValuesFilter(Dictionary<int, double> elevationValues)
                => _elevationValue = elevationValues;

            bool ICoordinateSequenceFilter.Done => false;
            bool ICoordinateSequenceFilter.GeometryChanged => true;

            public void Filter(CoordinateSequence seq, int i)
            {
                seq.SetZ(i, _elevationValue[i]);
            }
        }

        /// <summary>
        /// Main helper function to set the elevation for a geometry
        /// </summary>
        /// <param name="geometry"></param>
        /// <param name="elevationGateway"></param>
        public static void SetElevation(Geometry geometry, IElevationGateway elevationGateway)
        {
            var getCoordinatesFilter = new GetCoordinatesFilter();
            geometry.Apply(getCoordinatesFilter);
            var coordinates = getCoordinatesFilter.CoordinatesMap
                .OrderBy(k => k.Key)
                .ToArray();
            var elevationValues = elevationGateway.GetElevation(coordinates.Select(c => c.Value).ToArray()).Result;
            var elevationDictionary = new Dictionary<int, double>();
            for (var index = 0; index < coordinates.Length; index++)
            {
                var keyValuePair = coordinates[index];
                elevationDictionary[keyValuePair.Key] = elevationValues[index];
            }
            var setElevationValuesFilter = new SetElevationValuesFilter(elevationDictionary);
            geometry.Apply(setElevationValuesFilter);
        }

        /// <summary>
        /// Main helper function to set the elevation for a coleection of features
        /// </summary>
        /// <param name="features"></param>
        /// <param name="elevationGateway"></param>
        public static void SetElevation(IEnumerable<Feature> features, IElevationGateway elevationGateway)
        {
            foreach (var feature in features)
            {
                SetElevation(feature.Geometry, elevationGateway);
            }
        }
    }

    
}
