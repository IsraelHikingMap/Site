using ProjNet.CoordinateSystems.Transformations;

namespace IsraelHiking.API.Executors;

/// <summary>
/// This is a factory for MathTransform for ITM to WGS84 transform.
/// </summary>
public interface IItmWgs84MathTransformFactory
{
    /// <summary>
    /// Creates a coordinates transformation from ITM to WGS84.
    /// </summary>
    /// <returns></returns>
    MathTransform Create();

    /// <summary>
    /// Creates a coordinates transformation from WGS84 to ITM.
    /// </summary>
    /// <returns></returns>
    MathTransform CreateInverse();
}