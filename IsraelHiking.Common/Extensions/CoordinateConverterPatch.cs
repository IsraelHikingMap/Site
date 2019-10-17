using NetTopologySuite.Geometries;
using NetTopologySuite.IO.Converters;
using System;

namespace IsraelHiking.Common.Extensions
{
    public class CoordinateConverterPatch : CoordinateConverter
    {
        public CoordinateConverterPatch() : base() { }
        public CoordinateConverterPatch(PrecisionModel precisionModel, int dimension) : base(precisionModel, dimension) { }

        public override bool CanConvert(Type objectType)
        {
            return base.CanConvert(objectType) || typeof(CoordinateZ) == objectType;
        }
    }
}
