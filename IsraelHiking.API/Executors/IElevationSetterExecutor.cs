using System.Collections.Generic;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API.Executors;

/// <summary>
/// This helper created new geometry with elevation values
/// </summary>
public interface IElevationSetterExecutor
{
    /// <summary>
    /// Main helper function to set the elevation for a geometry
    /// </summary>
    /// <param name="geometry">The geometry to update</param>
    Geometry GeometryTo3D(Geometry geometry);

    /// <summary>
    /// Main helper function to set the elevation for a collection of features
    /// </summary>
    /// <param name="features">The features to update</param>
    void GeometryTo3D(IEnumerable<IFeature> features);
}