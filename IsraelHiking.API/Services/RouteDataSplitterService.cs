using IsraelHiking.API.Executors;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.DataContainer;
using Microsoft.Extensions.Options;
using NetTopologySuite.Geometries;
using NetTopologySuite.Simplify;
using ProjNet.CoordinateSystems.Transformations;
using System;
using System.Collections.Generic;
using System.Linq;

namespace IsraelHiking.API.Services;

///<inheritdoc/>
public class RouteDataSplitterService : IRouteDataSplitterService
{
    private readonly MathTransform _wgs84ItmMathTransform;
    private readonly ConfigurationData _options;

    /// <summary>
    /// Constructor
    /// </summary>
    /// <param name="itmWgs84MathTransformFactory"></param>
    /// <param name="options"></param>
    public RouteDataSplitterService(IItmWgs84MathTransformFactory itmWgs84MathTransformFactory,
        IOptions<ConfigurationData> options)
    {
        _wgs84ItmMathTransform = itmWgs84MathTransformFactory.CreateInverse();
        _options = options.Value;
    }

    ///<inheritdoc/>
    public RouteData Split(RouteData routeData)
    {
        var allRoutePoints = routeData.Segments.SelectMany(s => s.Latlngs).ToList();
        var coordinates = ToWgs84Coordinates(allRoutePoints);
        int maximumPoints = Math.Max(3, Math.Min((int)(new LineString(coordinates).Length / _options.MinimalSegmentLength), _options.MaxSegmentsNumber));
        var currentDistanceTolerance = _options.InitialSplitSimplificationDistanceTolerance;
        Coordinate[] simplifiedCoordinates;
        do
        {
            simplifiedCoordinates = DouglasPeuckerLineSimplifier.Simplify(coordinates, currentDistanceTolerance);
            currentDistanceTolerance *= 2;
        } while (simplifiedCoordinates.Length > maximumPoints);

        var manipulatedRouteData = new RouteData
        {
            Segments =
            [
                new RouteSegmentData
                {
                    RoutingType = RoutingType.HIKE,
                    RoutePoint = allRoutePoints.First(),
                    Latlngs = [allRoutePoints.First(), allRoutePoints.First()]
                }
            ],
            Name = routeData.Name
        };

        for (int index = 1; index < simplifiedCoordinates.Length; index++)
        {
            var currentIndex = coordinates.ToList().IndexOf(simplifiedCoordinates[index]);
            coordinates = coordinates.Skip(currentIndex).ToArray();

            var latLngs = allRoutePoints.Take(currentIndex + 1).ToList();
            allRoutePoints = allRoutePoints.Skip(currentIndex).ToList();
            manipulatedRouteData.Segments.Add(new RouteSegmentData
            {
                RoutingType = RoutingType.HIKE,
                Latlngs = latLngs,
                RoutePoint = latLngs.Last()
            });
        }

        return manipulatedRouteData;
    }

    private Coordinate[] ToWgs84Coordinates(IEnumerable<LatLng> latLngs)
    {
        return latLngs.Select(latLng => _wgs84ItmMathTransform.Transform(latLng.Lng, latLng.Lat)).Select(c => new Coordinate(c.x, c.y)).ToArray();
    }
}