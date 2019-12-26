using GeoAPI.Geometries;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi
{
    public abstract class BasePointsOfInterestAdapterTestsHelper
    {
        protected IElevationDataStorage _elevationDataStorage;
        protected IElasticSearchGateway _elasticSearchGateway;
        protected IDataContainerConverterService _dataContainerConverterService;
        protected IItmWgs84MathTransfromFactory _itmWgs84MathTransfromFactory;
        protected IOptions<ConfigurationData> _options;

        protected void InitializeSubstitues()
        {
            _itmWgs84MathTransfromFactory = new ItmWgs84MathTransfromFactory();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            _elasticSearchGateway = Substitute.For<IElasticSearchGateway>();
            _elevationDataStorage = Substitute.For<IElevationDataStorage>();
            _options = Substitute.For<IOptions<ConfigurationData>>();
            _options.Value.Returns(new ConfigurationData());
        }

        protected Feature GetValidFeature(string poiId, string source)
        {
            return new Feature
            {
                Geometry = new LineString(new[]
                {
                    new Coordinate(0, 0, double.NaN),
                    new Coordinate(1, 1, double.NaN),
                }),
                Attributes = new AttributesTable
                {
                    {FeatureAttributes.POI_CATEGORY, FeatureAttributes.POI_CATEGORY},
                    {FeatureAttributes.NAME, FeatureAttributes.NAME},
                    {FeatureAttributes.ID, poiId},
                    {FeatureAttributes.POI_SOURCE, source},
                    {FeatureAttributes.POI_ICON, FeatureAttributes.POI_ICON},
                    {FeatureAttributes.POI_ICON_COLOR, FeatureAttributes.POI_ICON_COLOR},
                    {FeatureAttributes.POI_ALT, 11.1},
                    {
                        FeatureAttributes.POI_GEOLOCATION, new AttributesTable
                        {
                            {FeatureAttributes.LAT, 1.1},
                            {FeatureAttributes.LON, 2.2}
                        }
                    }
                }
            };
        }
    }
}
