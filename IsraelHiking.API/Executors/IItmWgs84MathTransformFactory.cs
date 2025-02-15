using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Executors;

/// <summary>
/// This is a factory for IMathtransform for ITM to WGS84 transform.
/// </summary>
public interface IItmWgs84MathTransformFactory
{
    /// <summary>
    /// Creates a coordinats transfomation from ITM to WGS84.
    /// </summary>
    /// <returns></returns>
    MathTransform Create();

    /// <summary>
    /// Creates a coordinats transfomation from WGS84 to ITM.
    /// </summary>
    /// <returns></returns>
    MathTransform CreateInverse();
}