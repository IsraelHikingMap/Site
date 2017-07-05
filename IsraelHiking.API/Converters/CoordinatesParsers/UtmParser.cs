using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;
using GeoAPI.Geometries;
using GeoAPI.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Converters.CoordinatesParsers
{
    /// <summary>
    /// This class will parse ITM and ICS coordinates
    /// </summary>
    public class UtmParser : BaseCoordinatesParser
    {
        private readonly IMathTransform _itmWgs84MathTransform;

        /// <inheritdoc/>
        public override Regex Matcher
        {
            get
            {
                return new Regex(@"^(\d{6})" + DELIMITER_REGEX_STRING + @"(\d{6,7})$");
            }
        }

        /// <summary>
        /// Constructor
        /// </summary>
        /// <param name="itmWgs84MathTransform"></param>
        public UtmParser(IMathTransform itmWgs84MathTransform)
        {
            _itmWgs84MathTransform = itmWgs84MathTransform;
        }

        /// <inheritdoc/>
        protected override Coordinate GetCoordinates(Match itmMatch)
        {
            var easting = int.Parse(itmMatch.Groups[1].Value);
            var northing = int.Parse(itmMatch.Groups[2].Value);
            if (northing < 1350000)
            {
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
                    return _itmWgs84MathTransform.Transform(new Coordinate(double.Parse(itmMatch.Groups[1].Value), double.Parse(itmMatch.Groups[2].Value)));
                }
            }
            return null;
        }
    }
}
