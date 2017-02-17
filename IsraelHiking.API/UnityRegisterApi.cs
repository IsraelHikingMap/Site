using System.Diagnostics.CodeAnalysis;
using GeoAPI.Geometries;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.API.Services.Osm;
using IsraelHiking.Common;
using IsraelTransverseMercator;
using Microsoft.Practices.Unity;
using NetTopologySuite.Geometries;

namespace IsraelHiking.API
{
    [ExcludeFromCodeCoverage]
    public static class UnityRegisterApi
    {
        public static void RegisterUnityTypes(IUnityContainer container)
        {
            container.RegisterType<IGpxGeoJsonConverter, GpxGeoJsonConverter>();
            container.RegisterType<IGpxDataContainerConverter, GpxDataContainerConverter>();
            container.RegisterType<IOsmGeoJsonConverter, OsmGeoJsonConverter>();
            container.RegisterType<ICoordinatesConverter, CoordinatesConverter>();
            container.RegisterType<IDataContainerConverterService, DataContainerConverterService>();
            container.RegisterType<IRouteDataSplitterService, RouteDataSplitterService>();
            container.RegisterType<IGpxProlongerExecutor, GpxProlongerExecutor>();
            container.RegisterType<IGpxLoopsSplitterExecutor, GpxLoopsSplitterExecutor>();
            container.RegisterType<IAddibleGpxLinesFinderService, AddibleGpxLinesFinderService>();
            container.RegisterType<IOsmGeoJsonPreprocessor, OsmGeoJsonPreprocessor>();
            container.RegisterType<IOsmDataService, OsmDataService>();
            container.RegisterType<LruCache<string, TokenAndSecret>>(new ContainerControlledLifetimeManager());
            container.RegisterType<IGeometryFactory, GeometryFactory>(new ContainerControlledLifetimeManager(), new InjectionConstructor(new PrecisionModel(100000000)));
            container.RegisterType<IImageCreationService, ImageCreationService>();
            container.RegisterType<IOsmLineAdderService, OsmLineAdderService>();
        }
    }
}
