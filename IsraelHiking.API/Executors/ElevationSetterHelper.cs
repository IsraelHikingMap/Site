using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Geometries;
using System;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This helper helps setting the z value of coordinate sequence
    /// </summary>
    public static class ElevationSetterHelper
    {
        private sealed class SetElevationValuesFilter : ICoordinateSequenceFilter
        {
            readonly Func<double, double, double> _XYToElevation;

            public SetElevationValuesFilter(Func<double, double, double> XYToElevation)
                => _XYToElevation = XYToElevation;

            bool ICoordinateSequenceFilter.Done => false;
            bool ICoordinateSequenceFilter.GeometryChanged => true;

            public void Filter(CoordinateSequence seq, int i)
            {
                seq.SetZ(i, _XYToElevation(seq.GetX(i), seq.GetY(i)));
            }
        }

        /// <summary>
        /// Main helper function to set the elevation
        /// </summary>
        /// <param name="geometry"></param>
        /// <param name="elevationDataStorage"></param>
        public static void SetElevation(Geometry geometry, IElevationDataStorage elevationDataStorage)
        {
            var setElevationValuesFilter = new SetElevationValuesFilter((x, y) => elevationDataStorage.GetElevation(new Coordinate(x,y)).Result);
            geometry.Apply(setElevationValuesFilter);
        }
    }

    
}
