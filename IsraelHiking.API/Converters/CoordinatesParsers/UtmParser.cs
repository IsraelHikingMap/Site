﻿using System;
using IsraelHiking.API.Executors;
using NetTopologySuite.Geometries;
using ProjNet.CoordinateSystems.Transformations;
using System.Text.RegularExpressions;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class will parse ITM and ICS coordinates
    /// </summary>
    [Obsolete("Not in use any more 5.2022")]
    public class UtmParser : BaseCoordinatesParser
    {
        private readonly MathTransform _itmWgs84MathTransform;

        /// <inheritdoc/>
        public override Regex Matcher => new Regex(@"^(\d{6})" + DELIMITER_REGEX_STRING + @"(\d{6,7})$");

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="itmWgs84MathTransformFactory"></param>
        public UtmParser(IItmWgs84MathTransfromFactory itmWgs84MathTransformFactory)
        {
            _itmWgs84MathTransform = itmWgs84MathTransformFactory.Create();
        }

        /// <inheritdoc/>
        protected override Coordinate GetCoordinates(Match itmMatch)
        {
            var easting = int.Parse(itmMatch.Groups[1].Value);
            var northing = int.Parse(itmMatch.Groups[2].Value);
            if (northing >= 1350000)
            {
                return null;
            }
            if (northing < 350000)
            {
                easting = easting + 50000;
                northing = northing + 500000;
            }
            else if (northing > 850000)
            {
                easting = easting + 50000;
                northing = northing - 500000;
            }
            if (easting >= 100000 && easting <= 300000)
            {
                var transformed = _itmWgs84MathTransform.Transform(easting, northing);
                return new Coordinate(transformed.x, transformed.y);
            }
            return null;
        }
    }
}
