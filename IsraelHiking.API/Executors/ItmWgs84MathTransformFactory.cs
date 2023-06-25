using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;
using System.Collections.Generic;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class ItmWgs84MathTransformFactory : IItmWgs84MathTransformFactory
    {
        private readonly ProjectedCoordinateSystem _itm;

        /// <summary>
        /// Factory's constructor
        /// </summary>
        public ItmWgs84MathTransformFactory()
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
                new AxisInfo("East", AxisOrientationEnum.East), new AxisInfo("North", AxisOrientationEnum.North)) as ProjectedCoordinateSystem;
        }

        /// <inheritdoc />
        public MathTransform Create()
        {
            var coordinateTransformFactory = new CoordinateTransformationFactory();
            return coordinateTransformFactory.CreateFromCoordinateSystems(_itm, GeographicCoordinateSystem.WGS84).MathTransform as MathTransform;
        }

        /// <inheritdoc />
        public MathTransform CreateInverse()
        {
            var coordinateTransformFactory = new CoordinateTransformationFactory();
            return coordinateTransformFactory.CreateFromCoordinateSystems(GeographicCoordinateSystem.WGS84, _itm).MathTransform as MathTransform;
        }
    }
}
