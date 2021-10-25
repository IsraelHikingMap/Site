using System.Linq;
using IsraelHiking.API.Executors;
using IsraelHiking.API.Services;
using IsraelHiking.Common;
using IsraelHiking.Common.Configuration;
using IsraelHiking.Common.Extensions;
using IsraelHiking.DataAccessInterfaces;
using Microsoft.Extensions.Options;
using NetTopologySuite.Features;
using NetTopologySuite.Geometries;
using NSubstitute;

namespace IsraelHiking.API.Tests.Services.Poi
{
    public abstract class BasePointsOfInterestAdapterTestsHelper
    {
        protected IElevationGateway ElevationGateway;
        protected IDataContainerConverterService _dataContainerConverterService;
        protected IItmWgs84MathTransfromFactory _itmWgs84MathTransfromFactory;
        protected IOptions<ConfigurationData> _options;

        protected void InitializeSubstitutes()
        {
            _itmWgs84MathTransfromFactory = new ItmWgs84MathTransfromFactory();
            _dataContainerConverterService = Substitute.For<IDataContainerConverterService>();
            ElevationGateway = Substitute.For<IElevationGateway>();
            ElevationGateway.GetElevation(Arg.Any<Coordinate[]>()).Returns(info => Enumerable.Repeat(1.0, info.Arg<Coordinate[]>().Length).ToArray());
            _options = Substitute.For<IOptions<ConfigurationData>>();
            _options.Value.Returns(new ConfigurationData());
        }

        protected Feature GetValidFeature(string poiId, string source)
        {
            var feature = new Feature
            {
                Geometry = new LineString(new[]
                {
                    new CoordinateZ(0, 0, double.NaN),
                    new CoordinateZ(1, 1, double.NaN),
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
                }
            };
            feature.SetLocation(new Coordinate(2.2, 1.1));
            return feature;
        }
    }
}
