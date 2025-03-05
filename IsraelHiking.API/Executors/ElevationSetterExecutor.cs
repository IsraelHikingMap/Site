using System;
using IsraelHiking.DataAccessInterfaces;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Executors;

/// <inheritdoc/>
public class ElevationSetterExecutor : IElevationSetterExecutor
{
    private readonly IElevationGateway _elevationGateway;

    /// <summary>
    /// Constructor
    /// </summary>
    public ElevationSetterExecutor(IElevationGateway elevationGateway)
    {
        _elevationGateway = elevationGateway;
    }
        
    private Coordinate[] CoordinatesTo3D(Coordinate[] coordinatesArray)
    {
        var zValues = _elevationGateway.GetElevation(coordinatesArray).Result;
        return coordinatesArray.Select((c, i) => new CoordinateZ(c.X, c.Y, zValues[i]) as Coordinate)
            .ToArray();
    }

    private Point PointTo3D(Point point)
    {
        var z = _elevationGateway.GetElevation(point.Coordinate).Result;
        return new Point(point.Coordinate.X, point.Coordinate.Y, z);
    }
        
    private LinearRing LinearRingTo3D(LinearRing linearRing)
    {
        return new LinearRing(CoordinatesTo3D(linearRing.Coordinates));
    }

    private Polygon PolygonTo3D(Polygon polygon)
    {
        return new Polygon(LinearRingTo3D(polygon.Shell),
            polygon.Holes.Select(LinearRingTo3D).ToArray());
    }
        
    /// <inheritdoc/>
    public Geometry GeometryTo3D(Geometry geometry)
    {
        switch (geometry.OgcGeometryType)
        {
            case OgcGeometryType.Point:
                return PointTo3D((Point)geometry);
            case OgcGeometryType.LineString:
                return new LineString(CoordinatesTo3D(geometry.Coordinates));
            case OgcGeometryType.Polygon:
                return PolygonTo3D((Polygon)geometry);
            case OgcGeometryType.MultiPoint:
                var multiPoint = (MultiPoint)geometry;
                return new MultiPoint(multiPoint.Geometries.Cast<Point>().Select(PointTo3D).ToArray());
            case OgcGeometryType.MultiPolygon:
                var multiPolygon = (MultiPolygon)geometry;
                return new MultiPolygon(multiPolygon.Geometries.Cast<Polygon>()
                    .Select(PolygonTo3D).ToArray());
            case OgcGeometryType.MultiLineString:
                var multiLineString = (MultiLineString)geometry;
                return new MultiLineString(multiLineString.Geometries.Cast<LineString>()
                    .Select(l => new LineString(CoordinatesTo3D(l.Coordinates))).ToArray());
            case OgcGeometryType.GeometryCollection:
                var geometryCollection = (GeometryCollection)geometry;
                return new GeometryCollection(geometryCollection.Geometries
                    .Select(GeometryTo3D).ToArray());
            default:
                throw new Exception("Invalid type: " + geometry.OgcGeometryType);
        }
    }

    /// <inheritdoc/>
    public void GeometryTo3D(IEnumerable<IFeature> features)
    {
        foreach (var feature in features)
        {
            feature.Geometry = GeometryTo3D(feature.Geometry);
        }
    }
}