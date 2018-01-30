using System.Collections.Generic;
using GeoAPI.CoordinateSystems;
using GeoAPI.CoordinateSystems.Transformations;
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class ItmWgs84MathTransfromFactory : IItmWgs84MathTransfromFactory
    {
        private readonly IProjectedCoordinateSystem _itm;
        private readonly IGeographicCoordinateSystem _wgs84;

        /// <summary>
        /// Factory's constructor
        /// </summary>
        public ItmWgs84MathTransfromFactory()
        {
            var coordinateSystemFactory = new CoordinateSystemFactory();
            var itmParameters = new List<ProjectionParameter>
            {
                new ProjectionParameter("latitude_of_origin", 31 + (44 + 03.8170/60)/60),
                new ProjectionParameter("central_meridian", 35 + (12 + 16.2610/60)/60),
                new ProjectionParameter("false_northing", 626907.390),
                new ProjectionParameter("false_easting", 219529.584),
                new ProjectionParameter("scale_factor", 1.0000067)
            };

            var itmDatum = coordinateSystemFactory.CreateHorizontalDatum("Isreal 1993", DatumType.HD_Geocentric,
                Ellipsoid.GRS80, new Wgs84ConversionInfo(-24.0024, -17.1032, -17.8444, -0.33077, -1.85269, 1.66969, 5.4248));

            var itmGeo = coordinateSystemFactory.CreateGeographicCoordinateSystem("ITM", AngularUnit.Degrees, itmDatum,
                PrimeMeridian.Greenwich, new AxisInfo("East", AxisOrientationEnum.East), new AxisInfo("North", AxisOrientationEnum.North));

            var itmProjection = coordinateSystemFactory.CreateProjection("Transverse_Mercator", "Transverse_Mercator", itmParameters);
            _itm = coordinateSystemFactory.CreateProjectedCoordinateSystem("ITM", itmGeo, itmProjection, LinearUnit.Metre,
                new AxisInfo("East", AxisOrientationEnum.East), new AxisInfo("North", AxisOrientationEnum.North));

            _wgs84 = ProjectedCoordinateSystem.WGS84_UTM(36, true).GeographicCoordinateSystem;
        }

        /// <inheritdoc />
        public IMathTransform Create()
        {
            var coordinateTransformFactory = new CoordinateTransformationFactory();
            return coordinateTransformFactory.CreateFromCoordinateSystems(_itm, _wgs84).MathTransform;
        }

        /// <inheritdoc />
        public IMathTransform CreateInverse()
        {
            var coordinateTransformFactory = new CoordinateTransformationFactory();
            return coordinateTransformFactory.CreateFromCoordinateSystems(_wgs84, _itm).MathTransform;
        }
    }
}
