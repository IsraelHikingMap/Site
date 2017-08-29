using System;
using System.Collections.Generic;
using GeoAPI.CoordinateSystems;
using GeoAPI.CoordinateSystems.Transformations;
using GeoAPI.Geometries;
using ProjNet.CoordinateSystems;
using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Executors
{
    /// <inheritdoc />
    public class ItmWgs84MathTransfrom : IMathTransform
    {
        private readonly IMathTransform _transform;
        private readonly IMathTransform _inverseTransform;
        private readonly bool _isInverse;

        /// <inheritdoc />
        public int DimSource { get; }
        /// <inheritdoc />
        public int DimTarget { get; }
        /// <inheritdoc />
        public string WKT { get; }
        /// <inheritdoc />
        public string XML { get; }

        /// <summary>
        /// Constructor
        /// </summary>
        public ItmWgs84MathTransfrom() : this (false) { }

        /// <summary>
        /// protected constructor to build this object with inverse transform
        /// </summary>
        /// <param name="isInverse"></param>
        protected ItmWgs84MathTransfrom(bool isInverse)
        {
            var coordinateTransformFactory = new CoordinateTransformationFactory();
            var coordinateSystemFactory = new CoordinateSystemFactory();
            var itmParameters = new List<ProjectionParameter>
            {
                new ProjectionParameter("latitude_of_origin", 31.734393611111109123611111111111),
                new ProjectionParameter("central_meridian", 35.204516944444442572222222222222),
                new ProjectionParameter("false_northing", 626907.390),
                new ProjectionParameter("false_easting", 219529.584),
                new ProjectionParameter("scale_factor", 1.0000067)
            };

            var itmDatum = coordinateSystemFactory.CreateHorizontalDatum("Isreal 1993", DatumType.HD_Geocentric,
                Ellipsoid.GRS80, new Wgs84ConversionInfo(-24.0024, -17.1032, -17.8444, -0.33077, -1.85269, 1.66969, 5.4248));

            var itmGeo = coordinateSystemFactory.CreateGeographicCoordinateSystem("ITM", AngularUnit.Degrees, itmDatum,
                PrimeMeridian.Greenwich, new AxisInfo("East", AxisOrientationEnum.East), new AxisInfo("North", AxisOrientationEnum.North));

            var itmProjection = coordinateSystemFactory.CreateProjection("Transverse_Mercator", "Transverse_Mercator", itmParameters);
            var itm = coordinateSystemFactory.CreateProjectedCoordinateSystem("ITM", itmGeo, itmProjection, LinearUnit.Metre,
                new AxisInfo("East", AxisOrientationEnum.East), new AxisInfo("North", AxisOrientationEnum.North));
            
            var wgs84 = ProjectedCoordinateSystem.WGS84_UTM(36, true).GeographicCoordinateSystem;
            _inverseTransform = coordinateTransformFactory.CreateFromCoordinateSystems(wgs84, itm).MathTransform;
            _transform = coordinateTransformFactory.CreateFromCoordinateSystems(itm, wgs84).MathTransform;
            _isInverse = isInverse;
        }

        /// <inheritdoc />
        public bool Identity()
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public double[,] Derivative(double[] point)
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public List<double> GetCodomainConvexHull(List<double> points)
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public DomainFlags GetDomainFlags(List<double> points)
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public IMathTransform Inverse()
        {
            return new ItmWgs84MathTransfrom(!_isInverse);
        }

        /// <inheritdoc />
        public double[] Transform(double[] point)
        {
            return _isInverse
                ? _inverseTransform.Transform(point)
                : _transform.Transform(point);
        }

        /// <inheritdoc />
        public ICoordinate Transform(ICoordinate coordinate)
        {
            return _isInverse
                ? _inverseTransform.Transform(coordinate)
                : _transform.Transform(coordinate);
        }

        /// <inheritdoc />
        public Coordinate Transform(Coordinate coordinate)
        {
            return _isInverse
                ? _inverseTransform.Transform(coordinate)
                : _transform.Transform(coordinate);
        }

        /// <inheritdoc />
        public IList<double[]> TransformList(IList<double[]> points)
        {
            return _isInverse
                ? _inverseTransform.TransformList(points)
                : _transform.TransformList(points);
        }

        /// <inheritdoc />
        public IList<Coordinate> TransformList(IList<Coordinate> points)
        {
            return _isInverse
                ? _inverseTransform.TransformList(points)
                : _transform.TransformList(points);
        }

        /// <inheritdoc />
        public void Invert()
        {
            throw new NotImplementedException();
        }

        /// <inheritdoc />
        public ICoordinateSequence Transform(ICoordinateSequence coordinateSequence)
        {
            return _isInverse
                ? _inverseTransform.Transform(coordinateSequence)
                : _transform.Transform(coordinateSequence);
        }
    }
}
