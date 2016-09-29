using System.Diagnostics.CodeAnalysis;
using IsraelHiking.API.Converters;
using IsraelHiking.API.Services;
using IsraelTransverseMercator;
using Microsoft.Practices.Unity;

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
            container.RegisterType<IDouglasPeuckerReductionService, DouglasPeuckerReductionService>();
            container.RegisterType<IOsmGeoJsonPreprocessor, OsmGeoJsonPreprocessor>();
            container.RegisterType<IOsmDataService, OsmDataService>();
        }
    }
}
