using GeoAPI.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Executors
{
    /// <summary>
    /// This is a factory for IMathtransform for ITM to WGS84 transform.
    /// </summary>
    public interface IItmWgs84MathTransfromFactory
    {
        /// <summary>
        /// Creates a coordinats transfomation from ITM to WGS84.
        /// </summary>
        /// <returns></returns>
        IMathTransform Create();

        /// <summary>
        /// Creates a coordinats transfomation from WGS84 to ITM.
        /// </summary>
        /// <returns></returns>
        IMathTransform CreateInverse();
    }
}